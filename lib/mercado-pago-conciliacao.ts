import type {SupabaseClient} from '@supabase/supabase-js';
import {pagamentoVerificado} from './mercado-pago-eventos';
export async function consultarPagamentoLoja(db:SupabaseClient,p:any){
 if(p.provedor_pagamento!=='mercado_pago')throw Error('Este pedido não usa Mercado Pago.');
 const c=await db.from('integracoes_credenciais').select('credenciais,ambiente').eq('empresa_id',p.empresa_id).eq('provedor','mercado_pago').maybeSingle();
 const token=(c.data?.credenciais as any)?.access_token;
 if(c.error||!token)throw Error('Mercado Pago não configurado.');
 if(process.env.VERCEL_ENV==='preview'&&c.data?.ambiente!=='teste')throw Error('Preview aceita somente credenciais de teste.');
 const request=async(path:string,options:RequestInit={})=>{const r=await fetch(`https://api.mercadopago.com${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(10000),cache:'no-store'});if(!r.ok)throw Error('Não foi possível confirmar a operação no Mercado Pago.');return r.json();};
 const kind=p.forma_pagamento==='pix'?'order':'payment';let resource:any;
 if(kind==='order'){
  if(!String(p.pagamento_externo_id||'').startsWith('ORD'))throw Error('Cobrança Pix ainda não vinculada.');
  resource=await request(`/v1/orders/${encodeURIComponent(p.pagamento_externo_id)}`);
 }else if(p.mercado_pago_payment_id){resource=await request(`/v1/payments/${encodeURIComponent(p.mercado_pago_payment_id)}`);}
 else{
  const found=await request(`/v1/payments/search?external_reference=${encodeURIComponent(p.id)}&sort=date_created&criteria=desc&limit=50`);
  const results=(found.results||[]).filter((r:any)=>String(r.external_reference)===p.id);
  resource=results.find((r:any)=>pagamentoVerificado(r,'payment',p)==='pago')||results.find((r:any)=>pagamentoVerificado(r,'payment',p)==='reembolsado')||results[0];
  if(!resource)return {status:null,kind,resource:null,request};
 }
 if(typeof resource.live_mode==='boolean'&&resource.live_mode!==(c.data?.ambiente==='producao'))throw Error('Ambiente do pagamento divergente.');
 const status=pagamentoVerificado(resource,kind,p);
 return {status,kind,resource,request};
}
export async function conciliarPagamentoLoja(db:SupabaseClient,p:any){
 const current=await consultarPagamentoLoja(db,p);
 if(current.status){const r=await db.from('pedidos').update({status_pagamento:current.status,...(current.kind==='payment'?{mercado_pago_payment_id:String(current.resource.id)}:{})}).eq('id',p.id).eq('empresa_id',p.empresa_id).eq('provedor_pagamento','mercado_pago').in('status_pagamento',current.status==='reembolsado'?['pago','reembolsado']:['pendente','recusado']);if(r.error)throw Error('Não foi possível registrar a confirmação.');}
 if(current.status==='reembolsado'){const r=await db.from('estornos_pedido').update({estado:'confirmado',atualizado_em:new Date().toISOString()}).eq('pedido_id',p.id).eq('empresa_id',p.empresa_id);if(r.error)throw Error('Estorno confirmado no provedor, mas não registrado.');}
 const r=await db.from('pedidos').update({pagamento_consultado_em:new Date().toISOString()}).eq('id',p.id).eq('empresa_id',p.empresa_id);if(r.error)throw Error('Conciliação não registrada.');
 return current.status||p.status_pagamento;
}
