import { supabase } from "./supabase";
import { Produto } from "./types";

export async function getProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(
      `
      id, categoria, subcategoria, nome, descricao, foto_url, ativo, ordem, preco, preco_promocional,
      variacoes ( id, nome, preco ),
      produto_adicionais ( adicionais ( id, nome, preco ) )
    `
    )
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar produtos:", error.message);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    id: p.id,
    categoria: p.categoria,
    subcategoria: p.subcategoria ?? undefined,
    nome: p.nome,
    descricao: p.descricao ?? undefined,
    foto: p.foto_url ?? undefined,
    ativo: p.ativo,
    ordem: p.ordem ?? 0,
    preco: p.preco ?? undefined,
    precoPromocional: p.preco_promocional ?? undefined,
    variacoes: p.variacoes ?? [],
    adicionaisDisponiveis: p.produto_adicionais?.map((pa: any) => pa.adicionais) ?? undefined,
  }));
}
