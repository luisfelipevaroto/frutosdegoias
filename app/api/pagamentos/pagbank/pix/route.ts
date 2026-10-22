import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {criarPedidoPagBank,consultarPedidoPagBank} from '@/lib/pagbank/server';
import {pagamentoPermitido} from '@/lib/pagamentos';

export async function POST(req:Request){
 try{
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return NextResponse.json({error:'Pagamento indisponível.'},{status:503});
  const {pedidoId,email,cpf}=await req.json();
  if(!/^[0-9a-f-]{36}$/i.test(String(pedidoId||''))||!/^\S+@\S+\.\S+$/.test(String(email||'')))return NextResponse.json({error:'Dados inválidos.'},{status:400});
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false}});
  const {data:p}=await db.from('pedidos').select('id,numero,empresa_id,valor_total,status_pagamento,status_pedido,forma_pagamento,provedor_pagamento,pagamento_externo_id').eq('id',pedidoId).single();
  if(!p||p.provedor_pagamento!=='pagbank'||p.forma_pagamento!=='pix'||p.status_pagamento!=='pendente'||p.status_pedido==='cancelado')return NextResponse.json({error:'Pedido indisponível para PIX.'},{status:409});
  const [cfg,st,cred]=await Promise.all([
   db.from('configuracoes_loja').select('valor').eq('empresa_id',p.empresa_id).eq('chave','pagamentos').maybeSingle(),
   db.rpc('status_pagamento_online',{p_empresa_id:p.empresa_id}),
   db.from('integracoes_credenciais').select('ambiente,credenciais').eq('empresa_id',p.empresa_id).eq('provedor','pagbank').eq('pagamento_conectado',true).maybeSingle()
  ]);
  if(cfg.error||st.error||cred.error||!pagamentoPermitido(cfg.data?.valor,st.data||[],'pix',true)||!cred.data)return NextResponse.json({error:'PagBank não está ativo.'},{status:409});
  const ambiente=cred.data.ambiente==='producao'?'producao':'sandbox';
  const token=(cred.data.credenciais as {token?:string})?.token;
  if(!token)return NextResponse.json({error:'Credencial não configurada.'},{status:503});
  const credenciais={token,ambiente} as const;
  const amount=Math.round(Number(p.valor_total)*100);
  if(!Number.isSafeInteger(amount)||amount<100)return NextResponse.json({error:'Valor inválido.'},{status:400});
  const anterior=String(p.pagamento_externo_id||'');
  const order=anterior.startsWith('ORDE_')?await consultarPedidoPagBank<any>(credenciais,anterior):await criarPedidoPagBank<any>(credenciais,{
   reference_id:p.id,
   customer:{name:'Cliente delivery',email:String(email).trim(),tax_id:String(cpf||'').replace(/\D/g,'')},
   items:[{reference_id:p.id,name:'Pedido delivery',quantity:1,unit_amount:amount}],
   qr_codes:[{amount:{value:amount}}],
   notification_urls:[new URL('/api/pagamentos/pagbank/webhook',req.url).toString()]
  },p.id);
  const qr=order.qr_codes?.[0]||order.charges?.[0]?.qr_code;
  const code=qr?.text||null;
  if(!order.id||!code)return NextResponse.json({error:'PagBank não retornou o código PIX. Confira os dados e a chave PIX da conta.'},{status:502});
  if(!anterior){
   const saved=await db.from('pedidos').update({pagamento_externo_id:order.id,provedor_pagamento:'pagbank'}).eq('id',p.id).eq('empresa_id',p.empresa_id).eq('status_pagamento','pendente').is('pagamento_externo_id',null).select('id');
   if(saved.error||!saved.data?.length)return NextResponse.json({error:'Cobrança gerada, mas não foi possível vincular ao pedido. Contate a loja.'},{status:503});
  }
  return NextResponse.json({orderId:order.id,pedidoNumero:p.numero,qrCode:code,qrCodeBase64:null,ambiente:ambiente==='sandbox'?'teste':'producao'});
 }catch{return NextResponse.json({error:'Não foi possível gerar o PIX PagBank.'},{status:502})}
}
