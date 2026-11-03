import { NextResponse } from 'next/server';
import { autorizarErp, erpError } from '@/lib/erp-api-auth';
import { erpJson, erpUuid } from '@/lib/erp-pedidos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Context) {
  try {
    const auth = await autorizarErp(req);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    if (!erpUuid.test(id)) return erpError(400, 'ID de pedido invalido');
    const length = Number(req.headers.get('content-length') ?? 0);
    if (length > 4096) return erpError(413, 'Corpo muito grande');
    const raw = await req.text();
    if (Buffer.byteLength(raw, 'utf8') > 4096) return erpError(413, 'Corpo muito grande');
    let body: unknown = {};
    if (raw.trim()) {
      try { body = JSON.parse(raw); } catch { return erpError(400, 'JSON invalido'); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return erpError(400, 'Corpo invalido');
    const value = (body as Record<string, unknown>).referencia_erp;
    if (value !== undefined && value !== null &&
        (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 120))
      return erpError(400, 'referencia_erp invalida');
    const referencia = typeof value === 'string' ? value.trim() : null;

    const { data: pedido, error: pedidoError } = await auth.db.from('pedidos')
      .select('id').eq('empresa_id', auth.empresaId).eq('id', id).maybeSingle();
    if (pedidoError) throw pedidoError;
    if (!pedido) return erpError(404, 'Pedido nao encontrado');

    // A chave composta (empresa_id, pedido_id) impede duplicacao mesmo com requisicoes concorrentes.
    const { data: inserted, error: insertError } = await auth.db.from('erp_pedidos_importacoes')
      .upsert({
        empresa_id: auth.empresaId,
        pedido_id: id,
        chave_id: auth.chaveId,
        referencia_erp: referencia
      }, { onConflict: 'empresa_id,pedido_id', ignoreDuplicates: true })
      .select('pedido_id,referencia_erp,importado_em').maybeSingle();
    if (insertError) throw insertError;

    if (inserted) {
      return erpJson({ importado: true, ja_importado: false, pedido_id: id,
        referencia_erp: inserted.referencia_erp, importado_em: inserted.importado_em }, 201);
    }

    const { data: existing, error: existingError } = await auth.db.from('erp_pedidos_importacoes')
      .select('pedido_id,referencia_erp,importado_em')
      .eq('empresa_id', auth.empresaId).eq('pedido_id', id).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return erpError(503, 'Confirmacao indisponivel; tente novamente');
    if (referencia !== null && existing.referencia_erp !== referencia)
      return erpError(409, 'Pedido ja importado com outra referencia_erp');
    return erpJson({ importado: true, ja_importado: true, pedido_id: id,
      referencia_erp: existing.referencia_erp, importado_em: existing.importado_em });
  } catch {
    return erpError(503, 'Servico temporariamente indisponivel');
  }
}
