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
              COALESCE(c.ordem, 9999) AS categoria_ordem,
              COALESCE(sc.ordem, 9999) AS subcategoria_ordem,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', v.id, 'nome', v.nome, 'preco', v.preco)
                                 ORDER BY v.nome, v.id)
                  FROM public.variacoes v WHERE v.produto_id = p.id
              ), '[]'::jsonb) AS variacoes,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'preco', a.preco)
                                 ORDER BY a.ordem, a.id)
                  FROM public.produto_adicionais pa
                  JOIN public.adicionais a ON a.id = pa.adicional_id
                 WHERE pa.produto_id = p.id AND a.empresa_id = e.id
                   AND a.ativo = true AND a.grupo_id IS NULL
              ), '[]'::jsonb) AS adicionais,
              COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', g.id, 'nome', g.nome, 'gratis', g.gratis,
                    'minimo', g.minimo, 'maximo', g.maximo,
                    'itens', COALESCE((
                      SELECT jsonb_agg(
                        jsonb_build_object('id', a.id, 'nome', a.nome,
                                           'preco', CASE WHEN g.gratis THEN 0 ELSE a.preco END)
                        ORDER BY a.ordem, a.id)
                      FROM public.adicionais a
                      WHERE a.grupo_id = g.id AND a.empresa_id = e.id AND a.ativo
                    ), '[]'::jsonb)
                  ) ORDER BY g.criado_em, g.id
                )
                FROM public.produto_grupos_adicionais pg
                JOIN public.grupos_adicionais g ON g.id = pg.grupo_id
                WHERE pg.produto_id = p.id AND g.empresa_id = e.id AND g.ativo
              ), '[]'::jsonb) AS grupos_adicionais
         FROM public.produtos p
         JOIN public.empresas e ON e.id = p.empresa_id
         LEFT JOIN public.categorias c ON c.id = p.categoria_id AND c.empresa_id = e.id
         LEFT JOIN public.subcategorias sc ON sc.id = p.subcategoria_id AND sc.empresa_id = e.id
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
