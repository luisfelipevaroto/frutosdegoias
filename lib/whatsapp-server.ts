import type {SupabaseClient} from '@supabase/supabase-js';
import {statusVisualPedido} from './entregas';
export function mensagemTemplate(phone:string,template:string,language:string,nome:string,numero:unknown,status:string){
 let to=phone.replace(/\D/g,'');if(to.length===10||to.length===11)to='55'+to;if(!/^\d{12,15}$/.test(to))throw Error('Telefone inválido.');
 return {messaging_product:'whatsapp',to,type:'template',template:{name:template,language:{code:language},components:[{type:'body',parameters:[nome,String(numero),status].map(text=>({type:'text',text}))}]}};
}
export async function processarFilaWhatsApp(db:SupabaseClient,empresaId:string){
 if(process.env.WHATSAPP_AUTOMACAO_ATIVA!=='true')return;
 const c=await db.from('integracoes_credenciais').select('credenciais,ambiente').eq('empresa_id',empresaId).eq('provedor','meta_whatsapp').maybeSingle();
 const cred=c.data?.credenciais as Record<string,any>|undefined;
 if(c.error||cred?.envio_ativo!==true||!cred.template_name||!cred.access_token||!cred.graph_version)return;
 if(!/^v\d+\.\d+$/.test(cred.graph_version)||!/^\d{1,30}$/.test(cred.phone_number_id||''))return;
 if(process.env.VERCEL_ENV==='preview'&&c.data?.ambiente!=='teste')return;
 const rows=await db.rpc('reservar_notificacoes_whatsapp',{p_empresa:empresaId});if(rows.error)return;
 for(const q of rows.data||[]){
  let accepted=false,posted=false;
  try{
   const p=await db.from('pedidos').select('numero,status_pedido,pronto_em,whatsapp_optin,clientes(nome)').eq('empresa_id',empresaId).eq('id',q.pedido_id).single();
   if(p.error||!p.data)throw Error('Pedido indisponível.');
   const module=await db.rpc('modulo_empresa_ativo',{p_empresa_id:empresaId,p_chave:'whatsapp_api'});
   if(module.error)throw Error('Consulta de módulo indisponível.');
   if(module.data!==true||!p.data.whatsapp_optin||statusVisualPedido(p.data)!==q.status_pedido){
    await db.from('whatsapp_notificacoes').update({status_envio:'ignorado',erro:'Consentimento, módulo ou etapa atual incompatível.'}).eq('id',q.id).eq('empresa_id',empresaId);continue;
   }
   const labels:Record<string,string>={recebido:'recebido',em_preparo:'em preparo',pronto:'pronto para coleta ou retirada',saiu_para_entrega:'a caminho',entregue:'concluído',cancelado:'cancelado'};
   const client=Array.isArray(p.data.clientes)?p.data.clientes[0]:p.data.clientes;
   const payload=mensagemTemplate(q.telefone,cred.template_name,cred.template_language||'pt_BR',client?.nome||'Cliente',p.data.numero,labels[q.status_pedido]||q.status_pedido);posted=true;
   const r=await fetch(`https://graph.facebook.com/${cred.graph_version}/${cred.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${cred.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
   if(!r.ok){
    // A definitive rejection can be retried; uncertain delivery must be reviewed.
    if(r.status===429||r.status===400||r.status===401||r.status===403){await db.from('whatsapp_notificacoes').update({status_envio:'erro',erro:`Meta retornou HTTP ${r.status}`,proxima_tentativa_em:new Date(Date.now()+Math.min(3600000,60000*2**q.tentativas)).toISOString()}).eq('id',q.id).eq('empresa_id',empresaId);continue;}
    throw Error('Resposta incerta da Meta. Revise antes de reenviar.');
   }
   const body=await r.json(),id=body.messages?.[0]?.id;if(typeof id!=='string')throw Error('Resposta sem identificador.');
   accepted=true;
   const saved=await db.from('whatsapp_notificacoes').update({status_envio:'enviado',enviado_em:new Date().toISOString(),mensagem_externa_id:id,status_entrega:'aceito',erro:null}).eq('id',q.id).eq('empresa_id',empresaId);if(saved.error)throw Error('Envio não registrado.');
  }catch{
   // Never blindly resend a request which may already have been accepted.
   await db.from('whatsapp_notificacoes').update(posted?{erro:accepted?'Aceito pela Meta; confira o retorno de entrega.':'Envio incerto; revisão necessária.'}:{status_envio:'erro',erro:'Consulta interrompida antes do envio.',proxima_tentativa_em:new Date(Date.now()+60000).toISOString()}).eq('id',q.id).eq('empresa_id',empresaId);
  }
 }
}
