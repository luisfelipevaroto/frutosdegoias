import { NextResponse } from 'next/server';
import { autorizarErp, erpError } from '@/lib/erp-api-auth';
import { decodeCursor, encodeCursor, erpJson } from '@/lib/erp-pedidos';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const access = await autorizarErp(req);
    if (access instanceof NextResponse) return access;
    const params = new URL(req.url).searchParams;
    const limitRaw = params.get('limit') ?? '50';
    if (!/^\d{1,3}$/.test(limitRaw) || Number(limitRaw) < 1 || Number(limitRaw) > 100)
      return erpError(400, 'limit deve estar entre 1 e 100');
    const rawCursor = params.get('cursor');
    const cursor = rawCursor ? decodeCursor(rawCursor) : null;
    if (rawCursor && !cursor) return erpError(400, 'Cursor invalido');
    const limit = Number(limitRaw);
    let query = access.db.from('pedidos')
      .select('id,numero,criado_em,status_pedido,status_pagamento,valor_total,tipo_entrega,forma_pagamento')
      .eq('empresa_id', access.empresaId)
      .order('criado_em', { ascending: true }).order('id', { ascending: true }).limit(limit + 1);
    if (cursor) query = query.or(`criado_em.gt.${cursor.criado_em},and(criado_em.eq.${cursor.criado_em},id.gt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return erpJson({
      data: page,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: hasMore && last ? encodeCursor({ criado_em: last.criado_em, id: last.id }) : null
      }
    });
  } catch { return erpError(503, 'Servico temporariamente indisponivel'); }
}
