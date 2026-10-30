import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '../../../../lib/postgres-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const host = request.nextUrl.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return NextResponse.json({ error: 'Domínio da loja não configurado' }, { status: 400 });
  }

  try {
    const result = await getPostgresPool().query(
      `SELECT p.id, p.nome, p.descricao, p.foto_url, p.categoria, p.subcategoria,
              p.categoria_id, p.subcategoria_id, p.ordem, p.preco,
              p.preco_promocional, p.ativo,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', v.id, 'nome', v.nome, 'preco', v.preco)
                                 ORDER BY v.nome)
                  FROM public.variacoes v WHERE v.produto_id = p.id
              ), '[]'::jsonb) AS variacoes,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'preco', a.preco)
                                 ORDER BY a.ordem, a.nome)
                  FROM public.produto_adicionais pa
                  JOIN public.adicionais a ON a.id = pa.adicional_id
                 WHERE pa.produto_id = p.id AND a.ativo = true
              ), '[]'::jsonb) AS adicionais
         FROM public.produtos p
         JOIN public.empresas e ON e.id = p.empresa_id
        WHERE lower(e.dominio_principal) = $1
          AND e.ativo = true AND p.ativo = true
        ORDER BY p.ordem, p.nome`,
      [host],
    );
    return NextResponse.json(result.rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o catálogo' }, { status: 503 });
  }
}
