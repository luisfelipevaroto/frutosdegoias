import { supabase } from "./supabase";
import { Produto } from "./types";
import { getEmpresaAtual } from "./empresa";

export async function getProdutos(empresaId?: string): Promise<Produto[]> {
  const id = empresaId || (await getEmpresaAtual())?.id;
  if (!id) return [];

  const { data, error } = await supabase.rpc("catalogo_publico", { p_empresa_id: id });
  if (error) { console.error("Erro ao buscar catálogo público:", error.message); return []; }

  const lista = Array.isArray(data) ? data : [];
  return lista.map((p: any) => ({
    id: p.id,
    categoria: p.categoria,
    categoriaId: p.categoria_id ?? undefined,
    categoriaOrdem: p.categoria_ordem ?? 9999,
    subcategoria: p.subcategoria ?? undefined,
    subcategoriaId: p.subcategoria_id ?? undefined,
    subcategoriaOrdem: p.subcategoria_ordem ?? 9999,
    nome: p.nome,
    descricao: p.descricao ?? undefined,
    foto: p.foto_url ?? undefined,
    ativo: p.ativo,
    ordem: p.ordem ?? 0,
    preco: p.preco ?? undefined,
    precoPromocional: p.preco_promocional ?? undefined,
    variacoes: p.variacoes ?? [],
    adicionaisDisponiveis: p.adicionais ?? undefined
  }));
}
