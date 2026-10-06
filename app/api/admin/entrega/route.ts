import { NextResponse } from 'next/server';
import { autorizarEmpresa } from '@/lib/admin-server';
import { chamarUber, cotarUber, enderecoLoja, resumoUber, tokenUber } from '@/lib/uber-server';
import { telefoneUber } from '@/lib/entregas';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(req:Request){
 let db:any,entrega:any,criou=false;
 try {
  const input=await req.json();const {empresaId,pedidoId,acao}=input;
  if(typeof empresaId!=='string'||typeof pedidoId!=='string'||!['cotar','solicitar','atualizar'].includes(acao))return NextResponse.json({error:'Requisição inválida.'},{status:400});
  const auth=await autorizarEmpresa(req,empresaId);if(auth instanceof NextResponse)return auth;db=auth.db;
  const [p,e,loja,cfg,m,c]=await Promise.all([db.from('pedidos').select('*,clientes(nome,telefone,whatsapp)').eq('id',pedidoId).eq('empresa_id',empresaId).single(),db.from('entregas_integradas').select('*').eq('pedido_id',pedidoId).eq('empresa_id',empresaId).eq('provedor','uber_direct').maybeSingle(),db.from('empresas').select('id,nome,endereco,cidade,estado,cep,telefone,whatsapp,ativo').eq('id',empresaId).eq('ativo',true).single(),db.from('configuracoes_loja').select('valor').eq('empresa_id',empresaId).eq('chave','entrega').maybeSingle(),db.rpc('modulo_empresa_ativo',{p_empresa_id:empresaId,p_chave:'entrega_integrada'}),db.rpc('credencial_uber_direct_backend',{p_empresa_id:empresaId})]);
  if(p.error||!p.data||p.data.tipo_entrega!=='entrega'||loja.error||!loja.data)throw new Error('Pedido de entrega não encontrado.');
  if(e.error||m.error||cfg.error||c.error)throw new Error('Não foi possível verificar a integração.');
  entrega=e.data;const pedido=p.data,cred=Array.isArray(c.data)?c.data[0]:c.data;
  if(!cred)throw new Error('Configure as credenciais da Uber.');
  if(acao!=='atualizar'&&(m.data!==true||!cfg.data?.valor?.integrada||!cfg.data?.valor?.uber_direct))throw new Error('Uber não está ativo para esta empresa.');
  if(acao!=='atualizar'&&pedido.provedor_entrega!=='uber_direct'&&entrega?.provedor!=='uber_direct')throw new Error('Este pedido não foi feito com entrega Uber.');
  if(acao!=='atualizar'&&((pedido.status_pedido!=='em_preparo'||!pedido.pronto_em)||(pedido.provedor_pagamento&&pedido.status_pagamento!=='pago')))throw new Error('O pedido deve estar pronto e com o pagamento online confirmado.');
  const token=await tokenUber(cred);
  if(acao==='cotar'){
   if(entrega?.entrega_externa_id||['solicitando','incerto'].includes(entrega?.status))throw new Error('Já existe uma solicitação. Atualize ou retome a solicitação pendente.');
   telefoneUber(loja.data.telefone||loja.data.whatsapp);telefoneUber(pedido.clientes?.whatsapp||pedido.clientes?.telefone);
   const q=await cotarUber(db,cred,token,empresaId,enderecoLoja(loja.data),pedido.endereco_entrega,pedidoId);return NextResponse.json({...q,ambiente:cred.ambiente});
  }
  if(acao==='atualizar'){
   if(!entrega?.entrega_externa_id)throw new Error('A confirmação está pendente. Retome a solicitação com a mesma identificação.');
   if(entrega.ambiente&&entrega.ambiente!==cred.ambiente)throw new Error('Use as credenciais do mesmo ambiente da corrida.');
   const r=await chamarUber(cred,token,`deliveries/${encodeURIComponent(entrega.entrega_externa_id)}`);if(!r.ok)throw new Error('Não foi possível consultar esta corrida na Uber.');
   const s=resumoUber(r.body);if(s.id!==entrega.entrega_externa_id)throw new Error('A Uber retornou outra corrida.');
   const apply=await db.rpc('aplicar_evento_uber',{p_entrega:entrega.id,p_evento:null,p_externo:s.id,p_status:s.status,p_quando:s.updated,p_resumo:s});if(apply.error)throw new Error('Não foi possível salvar a atualização.');return NextResponse.json({ok:true});
  }
  const retry=['solicitando','incerto'].includes(entrega?.status);
  const quoteId=retry?entrega.quote_id:input.quoteId;
  const q=await db.from('uber_cotacoes').select('*').eq('quote_id',quoteId??'').eq('empresa_id',empresaId).eq('pedido_id',pedidoId).single();
  if(q.error||!q.data||q.data.customer_id!==cred.customer_id||q.data.ambiente!==cred.ambiente)throw new Error('Cotação não encontrada para este pedido e ambiente.');
  let payload:any;
  if(retry){if(!entrega.despacho_iniciado_em||Date.parse(entrega.despacho_iniciado_em)<Date.now()-3600000)throw new Error('Consulte a corrida no painel da Uber. A recuperação automática expirou para evitar uma corrida duplicada.');payload=entrega.request_payload;if(!payload)throw new Error('Consulte a corrida no painel da Uber antes de tentar novamente.');}
  else {
   if(Date.parse(q.data.expira_em)<=Date.now())throw new Error('Cotação expirada. Calcule novamente.');
   const itens=await db.from('itens_pedido').select('quantidade,preco_unitario,produtos(nome)').eq('pedido_id',pedidoId).eq('empresa_id',empresaId);if(itens.error||!itens.data?.length)throw new Error('Itens do pedido indisponíveis.');
   payload={quote_id:quoteId,pickup_name:loja.data.nome,pickup_address:q.data.origem,pickup_phone_number:telefoneUber(loja.data.telefone||loja.data.whatsapp),dropoff_name:pedido.clientes?.nome||'Cliente',dropoff_address:q.data.destino,dropoff_phone_number:telefoneUber(pedido.clientes?.whatsapp||pedido.clientes?.telefone),manifest_reference:String(pedido.numero),manifest_total_value:Math.round(itens.data.reduce((n:number,i:any)=>n+Number(i.preco_unitario)*i.quantidade,0)*100),manifest_items:itens.data.map((i:any)=>({name:String(i.produtos?.nome||'Produto').slice(0,100),quantity:i.quantidade,size:'small'})),external_id:pedido.id,undeliverable_action:'return',...(cred.ambiente==='teste'?{test_specifications:{robo_courier_specification:{mode:'auto'}}}:{})};
  }
  const claim=await db.rpc('reservar_despacho_uber',{p_empresa:empresaId,p_pedido:pedidoId,p_quote:quoteId,p_payload:payload});if(claim.error)throw new Error(claim.error.message);entrega=claim.data;
  if(entrega.entrega_externa_id)return NextResponse.json({ok:true,jaSolicitado:true});
  criou=true;const r=await chamarUber(cred,token,'deliveries',{...entrega.request_payload,idempotency_key:entrega.chave_idempotencia});
  if(!r.ok){const incerto=r.status>=500||[408,409,429].includes(r.status);const u=await db.from('entregas_integradas').update({status:incerto?'incerto':'erro',erro:incerto?'Confirmação pendente. Retome com a mesma identificação.':'A Uber recusou a solicitação. Confira a configuração e calcule novamente.'}).eq('id',entrega.id).is('entrega_externa_id',null).eq('status','solicitando');if(u.error)throw new Error('Confirmação pendente. Consulte a Uber antes de tentar outra corrida.');criou=false;throw new Error(incerto?'Confirmação pendente. Retome a solicitação.':'A Uber recusou a corrida. Confira a conta, os telefones e o endereço.');}
  const s=resumoUber(r.body);const apply=await db.rpc('aplicar_evento_uber',{p_entrega:entrega.id,p_evento:null,p_externo:s.id,p_status:s.status,p_quando:s.updated,p_resumo:s});if(apply.error)throw new Error('A corrida pode ter sido criada. Retome a solicitação para recuperar a confirmação.');criou=false;return NextResponse.json({ok:true});
 }catch(e){if(criou&&db&&entrega?.id)await db.from('entregas_integradas').update({status:'incerto',erro:'Confirmação pendente. Retome com a mesma identificação.'}).eq('id',entrega.id).is('entrega_externa_id',null).eq('status','solicitando');return NextResponse.json({error:e instanceof Error?e.message:'Não foi possível atualizar a entrega.'},{status:422});}
}

