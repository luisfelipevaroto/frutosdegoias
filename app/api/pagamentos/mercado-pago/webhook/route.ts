import {NextResponse,after} from 'next/server';
import {processarFilaWhatsApp} from '@/lib/whatsapp-server';
import {createClient} from '@supabase/supabase-js';
import {assinaturaValida,pagamentoVerificado} from '@/lib/mercado-pago-eventos';
export async function POST(req:Request) {
 try {
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return NextResponse.json({error:'Serviço indisponível.'},{status:503});
  const u=new URL(req.url),body=await req.json(),id=u.searchParams.get('data.id')||'',type=String(body.type||u.searchParams.get('type')||'');
  if(!['payment','order'].includes(type))return NextResponse.json({ok:true});
  if(!/^[a-z0-9_-]{1,100}$/i.test(id)||String(body.data?.id||'')!==id)return NextResponse.json({error:'Evento inválido.'},{status:400});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false}});
  const rows=await db.from('integracoes_credenciais').select('empresa_id,credenciais,ambiente').eq('provedor','mercado_pago');
  if(rows.error)return NextResponse.json({error:'Consulta indisponível.'},{status:503});
  let signed=false,failed=false,configured=false;
  for(const c of rows.data||[]) {
   const creds=c.credenciais as Record<string,string>,secret=creds?.webhook_secret||process.env.MERCADO_PAGO_WEBHOOK_SECRET||'';
   if(secret)configured=true;
   if(!assinaturaValida(req.headers.get('x-signature'),req.headers.get('x-request-id'),id,secret))continue;
   signed=true;if(!creds.access_token)continue;
   if(typeof body.live_mode==='boolean'&&body.live_mode!==(c.ambiente==='producao'))continue;
   const r=await fetch(`https://api.mercadopago.com/v1/${type==='order'?'orders':'payments'}/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${creds.access_token}`},cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!r.ok){if(r.status!==404&&r.status!==401)failed=true;continue;}
   const resource=await r.json();
   if(typeof resource.live_mode==='boolean'&&resource.live_mode!==(c.ambiente==='producao'))continue;
   const order=await db.from('pedidos').select('id,valor_total,forma_pagamento,provedor_pagamento,pagamento_externo_id').eq('id',resource.external_reference).eq('empresa_id',c.empresa_id).maybeSingle();
   if(order.error){failed=true;continue;}
   if(!order.data||order.data.provedor_pagamento!=='mercado_pago')continue;
   if(type==='order'&&String(order.data.pagamento_externo_id||'')!==String(resource.id))continue;
   const status=pagamentoVerificado(resource,type as 'order'|'payment',order.data);
   if(!status)return NextResponse.json({ok:true});
   const update=await db.from('pedidos').update({status_pagamento:status,...(type==='payment'?{mercado_pago_payment_id:String(resource.id)}:{})}).eq('id',order.data.id).eq('empresa_id',c.empresa_id).eq('provedor_pagamento','mercado_pago').in('status_pagamento',status==='reembolsado'?['pago','reembolsado']:['pendente','recusado']);
   if(update.error)return NextResponse.json({error:'Evento não confirmado.'},{status:503});
   if(process.env.WHATSAPP_AUTOMACAO_ATIVA==='true')after(()=>processarFilaWhatsApp(db,c.empresa_id));
   return NextResponse.json({ok:true});
  }
  if(!configured)return NextResponse.json({error:'Configure a chave de assinatura do webhook.'},{status:503});
  return NextResponse.json(signed&&!failed?{ok:true}:{error:signed?'Consulta indisponível.':'Assinatura não reconhecida.'},{status:signed?(failed?503:200):401});
 }catch{return NextResponse.json({error:'Evento não confirmado.'},{status:503});}
}
