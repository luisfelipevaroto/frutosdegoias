import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '../../../../lib/postgres-server';
import { resolveStoreDomain } from '../../../../lib/tenant-domain-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
  } catch (error: unknown) {
    // Diagnostico restrito a metadados; nao registrar URL, senha, host, SQL ou mensagem bruta.
    const code = error && typeof error === 'object' && 'code' in error &&
      typeof error.code === 'string' ? error.code : 'NO_CODE';
    const knownCodes = new Set([
      'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND',
      'EHOSTUNREACH', 'ENETUNREACH', 'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      'ERR_TLS_CERT_ALTNAME_INVALID', '28P01', '28000', '42501', '42P01',
    ]);
    const category = error instanceof Error && error.message.startsWith('DATABASE_')
      ? 'CONFIG'
      : knownCodes.has(code) ? code : 'OTHER';
    console.error('[delivery:empresa] falha na consulta', { category });
    return NextResponse.json({ error: 'Não foi possível consultar a loja' }, { status: 503 });
  }
}
