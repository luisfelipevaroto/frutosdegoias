import type {SupabaseClient} from '@supabase/supabase-js';
import {vencimentoConciliado} from './assinaturas-saas';
export function configuracaoSaas(){
 const token=process.env.SAAS_MERCADO_PAGO_ACCESS_TOKEN,origin=process.env.SAAS_APP_URL;
 if(!['teste','producao'].includes(process.env.SAAS_MERCADO_PAGO_AMBIENTE||''))throw Error('Informe o ambiente da conta SaaS.');
 if(!token||!origin)throw Error('Configure a conta Mercado Pago exclusiva da plataforma e seu endereço de retorno.');
 if(process.env.VERCEL_ENV==='preview'&&process.env.SAAS_MERCADO_PAGO_AMBIENTE!=='teste')throw Error('O piloto aceita somente a conta de teste SaaS.');
 const url=new URL(origin);if(url.protocol!=='https:')throw Error('O endereço da plataforma deve usar HTTPS.');
 return {token,origin:url.origin};
}
export async function recursoSaas(path:string,options:RequestInit={}){
 const {token}=configuracaoSaas();
 const r=await fetch(`https://api.mercadopago.com${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!r.ok)throw Error('Mercado Pago indisponível ou dados não aceitos. Revise o cadastro no provedor antes de repetir.');
 return r.json();
}
export async function conciliarSaas(db:SupabaseClient,empresaId:string){
 const c=await db.from('cobrancas_saas').select('*').eq('empresa_id',empresaId).single();
 if(c.error||!c.data?.preapproval_id)throw Error('Vincule primeiro a assinatura criada no Mercado Pago.');
 const sub=await recursoSaas(`/preapproval/${encodeURIComponent(c.data.preapproval_id)}`);
 if(String(sub.external_reference)!==c.data.referencia||sub.auto_recurring?.currency_id!=='BRL'||Math.round(Number(sub.auto_recurring?.transaction_amount)*100)!==Math.round(Number(c.data.payload.auto_recurring.transaction_amount)*100))throw Error('Assinatura divergente: nenhuma suspensão foi aplicada.');
 const invoices:any[]=[];
 for(let offset=0;;){
  const page=await recursoSaas(`/authorized_payments/search?preapproval_id=${encodeURIComponent(sub.id)}&limit=100&offset=${offset}`);
  if(!Array.isArray(page.results))throw Error('Consulta de faturas incompleta.');
  invoices.push(...page.results);offset+=page.results.length;
  if(offset>=Number(page.paging?.total))break;
  if(!page.results.length||offset>10000)throw Error('Consulta de faturas incompleta.');
 }
 const hoje=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const due=vencimentoConciliado(sub,invoices,Number(c.data.payload.auto_recurring.transaction_amount),hoje,c.data.primeiro_vencimento);
 const applied=await db.rpc('conciliar_assinatura_saas',{p_empresa:empresaId,p_vencimento:due,p_estado:sub.status,p_versao:c.data.versao_assinatura});
 if(applied.error)throw Error(applied.error.message);
 return applied.data;
}
