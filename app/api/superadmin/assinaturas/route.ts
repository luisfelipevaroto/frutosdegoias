import {NextResponse} from 'next/server';
import {autorizarSuperadmin,resposta} from '@/lib/superadmin-server';
import {configuracaoSaas,recursoSaas,conciliarSaas} from '@/lib/assinaturas-saas-server';
export async function GET(req:Request){
 const access=await autorizarSuperadmin(req);if(access instanceof NextResponse)return access;
 const r=await access.db.from('cobrancas_saas').select('empresa_id,preapproval_id,checkout_url,estado,primeiro_vencimento,suspensa_em,conciliada_em');
 if(r.error)return resposta({error:'Estrutura de cobrança automática ainda não instalada.'},503);
 let configurada=true;try{configuracaoSaas();}catch{configurada=false;}
 return resposta({configurada,contratos:r.data});
}
export async function POST(req:Request){
 try{
  const access=await autorizarSuperadmin(req);if(access instanceof NextResponse)return access;
  const {acao,empresaId,email,externalId}=await req.json();
  if(typeof empresaId!=='string'||! /^[0-9a-f-]{36}$/i.test(empresaId))return resposta({error:'Empresa inválida.'},400);
  const cfg=configuracaoSaas(),db=access.db;
  if(acao==='conciliar')return resposta(await conciliarSaas(db,empresaId));
  const existing=await db.from('cobrancas_saas').select('*').eq('empresa_id',empresaId).maybeSingle();if(existing.error)throw Error('Consulta indisponível.');
  if(acao==='vincular'){
   if(!existing.data||typeof externalId!=='string'||!/^[a-z0-9_-]{1,100}$/i.test(externalId))return resposta({error:'Identificador inválido.'},400);
   const remote=await recursoSaas(`/preapproval/${encodeURIComponent(externalId)}`);
   if(String(remote.external_reference)!==existing.data.referencia||remote.auto_recurring?.currency_id!=='BRL'||Math.round(Number(remote.auto_recurring?.transaction_amount)*100)!==Math.round(Number(existing.data.payload.auto_recurring.transaction_amount)*100))return resposta({error:'Assinatura pertence a outro contrato.'},409);
   const saved=await db.from('cobrancas_saas').update({preapproval_id:remote.id,checkout_url:remote.init_point,estado:remote.status==='pending'?'pendente':remote.status}).eq('empresa_id',empresaId).eq('referencia',existing.data.referencia);
   if(saved.error)throw Error('Não foi possível vincular.');return resposta({url:remote.init_point});
  }
  if(acao!=='criar')return resposta({error:'Ação inválida.'},400);
  if(existing.data)return existing.data.checkout_url?resposta({url:existing.data.checkout_url}):resposta({error:'Uma criação já foi iniciada. Confira a conta Mercado Pago e vincule o identificador; não gere outra assinatura.'},409);
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return resposta({error:'Informe o e-mail do responsável financeiro.'},400);
  const s=await db.from('assinaturas_empresa').select('*').eq('empresa_id',empresaId).single();
  if(s.error||!s.data||s.data.status==='cancelada'||Number(s.data.valor_mensal)<=0)return resposta({error:'Cadastre primeiro uma assinatura comercial com valor e plano.'},409);
  const hoje=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
  const due=s.data.fim_teste&&s.data.fim_teste>hoje?s.data.fim_teste:hoje;
  const payload={reason:`${s.data.nome_plano_snapshot} — assinatura delivery`,payer_email:email.trim(),back_url:`${cfg.origin}/admin/login`,status:'pending',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:Number(s.data.valor_mensal),currency_id:'BRL',...(due>hoje?{start_date:`${due}T12:00:00.000Z`}:{})}};
  const claimed=await db.from('cobrancas_saas').insert({empresa_id:empresaId,autor:access.userId,payload,primeiro_vencimento:due,versao_assinatura:s.data.versao}).select('referencia').single();
  if(claimed.error)return resposta({error:'A criação já foi iniciada ou o contrato mudou. Atualize o painel.'},409);
  const remote=await recursoSaas('/preapproval',{method:'POST',body:JSON.stringify({...payload,external_reference:claimed.data.referencia})});
  const saved=await db.from('cobrancas_saas').update({preapproval_id:remote.id,checkout_url:remote.init_point,estado:'pendente'}).eq('empresa_id',empresaId).eq('referencia',claimed.data.referencia);
  if(saved.error)throw Error('Assinatura criada no provedor; vincule seu identificador antes de repetir.');
  return resposta({url:remote.init_point});
 }catch(e){return resposta({error:e instanceof Error?e.message:'Cobrança indisponível.'},503);}
}
