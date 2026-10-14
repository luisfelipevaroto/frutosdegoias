import { createHmac, timingSafeEqual } from 'node:crypto';
export function assinaturaValida(signature: string | null, requestId: string | null, dataId: string, secret: string): boolean {
  if (!signature || !requestId || !dataId || !secret) return false;
  const parts = Object.fromEntries(signature.split(',').map(p => p.trim().split('=')));
  if (!/^\d+$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || '')) return false;
  const expected = createHmac('sha256',secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
  return timingSafeEqual(expected,Buffer.from(parts.v1,'hex'));
}
export function pagamentoVerificado(resource: any, kind: 'order' | 'payment', pedido: {id:string; valor_total:unknown}) {
  if (String(resource.external_reference || '') !== pedido.id || resource.currency_id !== 'BRL') return null;
  const total = Number(kind === 'order' ? resource.total_amount : resource.transaction_amount);
  if (!Number.isFinite(total) || Math.round(total*100) !== Math.round(Number(pedido.valor_total)*100)) return null;
  const status = String(resource.status || '');
  if (status === 'approved' || status === 'processed' && resource.status_detail === 'accredited') return 'pago';
  if (status === 'refunded' || kind==='order' && status==='processed' && resource.status_detail==='refunded') return 'reembolsado';
  if (status === 'rejected' || status === 'failed') return 'recusado';
  if (status === 'cancelled' || status === 'canceled') return 'cancelado';
  return null;
}
