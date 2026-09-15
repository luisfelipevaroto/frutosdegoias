import { supabase } from "./supabase";
import { Produto } from "./types";

// Substitui lib/produtos-mock.ts. Busca produtos ativos com suas variações
// e, quando existirem, os adicionais ligados via produto_adicionais
// (usado hoje só pelo "Monte do seu jeito").
export async function getProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from("produtos")
    .select(
      `
      id, categoria, nome, descricao, foto_url, ativo, preco,
      variacoes ( id, nome, preco ),
      produto_adicionais ( adicionais ( id, nome, preco ) )
    `
    )
    .eq("ativo", true);

  if (error) {
    console.error("Erro ao buscar produtos:", error.message);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    id: p.id,
    categoria: p.categoria,
    nome: p.nome,
    descricao: p.descricao ?? undefined,
    foto: p.foto_url ?? undefined,
    ativo: p.ativo,
    preco: p.preco ?? undefined,
    variacoes: p.variacoes ?? [],
    adicionaisDisponiveis:
      p.produto_adicionais?.map((pa: any) => pa.adicionais) ?? undefined,
  }));
}
