import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '../../../../lib/postgres-server';
import { resolveStoreDomain } from '../../../../lib/tenant-domain-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Apenas o hostname da URL efetivamente solicitada, nunca empresaId enviado pelo navegador.
  const host = resolveStoreDomain(request);
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return NextResponse.json({ error: 'Domínio da loja não configurado' }, { status: 400 });
  }

  try {
    const result = await getPostgresPool().query(
      `SELECT id, nome, slug, dominio_principal, logo_url, cor_primaria,
              cor_secundaria, whatsapp, telefone, endereco, cidade, estado, cep, configuracoes
         FROM public.empresas
        WHERE lower(dominio_principal) = $1
          AND ativo = true
        LIMIT 1`,
      [host],
    );
    if (!result.rows[0]) {
      return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar a loja' }, { status: 503 });
  }
}
