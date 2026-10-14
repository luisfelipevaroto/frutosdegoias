import {NextResponse} from 'next/server';
import {autorizarEmpresa} from '@/lib/admin-server';
import {consultarPagamentoLoja,conciliarPagamentoLoja} from '@/lib/mercado-pago-conciliacao';
export const maxDuration=60;
export async function POST(req:Request){
 try{
  const {empresaId,pedidoId,acao}=await req.json();if(typeof empresaId!=='string'||typeof pedidoId!=='string'||!['conciliar','estornar'].includes(acao))return NextResponse.json({error:'Dados inválidos.'},{status:400});
  const access=await autorizarEmpresa(req,empresaId);if(access instanceof NextResponse)return access;
  const p=await access.db.from('pedidos').select('*').eq('empresa_id',empresaId).eq('id',pedidoId).single();if(p.error||!p.data)return NextResponse.json({error:'Pedido não encontrado.'},{status:404});
  if(acao==='conciliar')return NextResponse.json({status:await conciliarPagamentoLoja(access.db,p.data)});
  if(p.data.status_pedido!=='cancelado'||!['pago','reembolsado'].includes(p.data.status_pagamento))return NextResponse.json({error:'Estorno disponível somente para pedido cancelado e pago.'},{status:409});
  const c=await consultarPagamentoLoja(access.db,p.data);
  if(c.status==='reembolsado')return NextResponse.json({status:await conciliarPagamentoLoja(access.db,p.data)});
  if(c.status!=='pago'||!c.resource)return NextResponse.json({error:'Pagamento aprovado não confirmado no provedor.'},{status:409});
  if(Number(c.resource.transaction_amount_refunded||0)>0)return NextResponse.json({error:'Estorno parcial existente: confira o restante no Mercado Pago.'},{status:409});
  const key=`${p.data.id}-refund`,known=await access.db.from('estornos_pedido').select('estado').eq('pedido_id',p.data.id).eq('empresa_id',empresaId).maybeSingle();if(known.error)throw Error('Consulta indisponível.');
  if(known.data)return NextResponse.json({error:'Uma solicitação já foi registrada. Concilie o pedido; se continuar pendente, confira e resolva o estorno no Mercado Pago.'},{status:409});
  if(!known.data){const saved=await access.db.from('estornos_pedido').insert({pedido_id:p.data.id,empresa_id:empresaId,autor:access.userId,chave:key});if(saved.error)return NextResponse.json({error:'Outra solicitação de estorno está em andamento. Concilie antes de repetir.'},{status:409});}
  try{
   if(c.kind==='order'){
    const payments=c.resource.transactions?.payments||[];if(payments.length!==1||!payments[0].id)throw Error('Estorno com várias transações requer conferência no provedor.');
    await c.request(`/v1/orders/${encodeURIComponent(c.resource.id)}/refund`,{method:'POST',headers:{'X-Idempotency-Key':key},body:JSON.stringify({transactions:[{id:payments[0].id,amount:Number(p.data.valor_total).toFixed(2)}]})});
   }else await c.request(`/v1/payments/${encodeURIComponent(c.resource.id)}/refunds`,{method:'POST',headers:{'X-Idempotency-Key':key},body:JSON.stringify({amount:Number(p.data.valor_total)})});
   const status=await conciliarPagamentoLoja(access.db,p.data),saved=await access.db.from('estornos_pedido').update({estado:status==='reembolsado'?'confirmado':'solicitado',atualizado_em:new Date().toISOString()}).eq('pedido_id',p.data.id).eq('empresa_id',empresaId);if(saved.error)throw Error('Estorno não registrado.');return NextResponse.json({status,mensagem:status==='reembolsado'?'Estorno confirmado.':'Solicitação enviada; aguarde confirmação e concilie o pedido.'});
  }catch{await access.db.from('estornos_pedido').update({estado:'incerto',atualizado_em:new Date().toISOString()}).eq('pedido_id',p.data.id).eq('empresa_id',empresaId);throw Error('Resultado incerto. Concilie e confira no Mercado Pago antes de repetir.');}
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Operação indisponível.'},{status:503});}
}
