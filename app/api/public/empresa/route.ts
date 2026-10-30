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
    const message = error instanceof Error ? error.message : '';
    const name = error instanceof Error ? error.name : 'UNKNOWN';
    const category = message.startsWith('DATABASE_') ? 'CONFIG'
      : knownCodes.has(code) ? code
      : message.includes('certificate') || message.includes('SSL') || message.includes('TLS') ? 'TLS'
      : message.includes('timeout') || message.includes('timed out') ? 'TIMEOUT'
      : 'OTHER';
    // Somente categorias predefinidas; nunca registrar mensagens brutas.
    const knownNames = new Set(['Error', 'TypeError', 'AggregateError', 'DatabaseError']);
    const safeName = knownNames.has(name) ? name : 'OTHER';
    const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : undefined;
    const causeCode = cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' ? cause.code : '';
    console.error('[delivery:empresa] falha na consulta', {
      category, name: safeName, code: knownCodes.has(code) ? code : 'OTHER',
      causeCode: knownCodes.has(causeCode) ? causeCode : 'OTHER',
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasCaCert: Boolean(process.env.DATABASE_CA_CERT),
    });
    return NextResponse.json({ error: 'Não foi possível consultar a loja' }, { status: 503 });
  }
}
