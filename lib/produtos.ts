import { supabase } from "./supabase";
import { Produto } from "./types";
import { getEmpresaAtual } from "./empresa";

export async function getProdutos(): Promise<Produto[]> {
  const empresa = await getEmpresaAtual();
  if (!empresa) return [];
  const { data, error } = await supabase
    .from("produtos")
    .select(`id, categoria, subcategoria, categoria_id, subcategoria_id, nome, descricao, foto_url, ativo, ordem, preco, preco_promocional, categorias ( nome, ordem ), subcategorias ( nome, ordem ), variacoes ( id, nome, preco ), produto_adicionais ( adicionais ( id, nome, preco ) )`)
    .eq("empresa_id", empresa.id)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) { console.error("Erro ao buscar produtos:", error.message); return []; }
  return (data ?? []).map((p: any) => ({
    id:p.id,
    categoria:p.categorias?.nome??p.categoria,
    categoriaId:p.categoria_id??undefined,
    categoriaOrdem:p.categorias?.ordem??9999,
    subcategoria:p.subcategorias?.nome??p.subcategoria??undefined,
    subcategoriaId:p.subcategoria_id??undefined,
    subcategoriaOrdem:p.subcategorias?.ordem??9999,
    nome:p.nome,
    descricao:p.descricao??undefined,
    foto:p.foto_url??undefined,
    ativo:p.ativo,
    ordem:p.ordem??0,
    preco:p.preco??undefined,
    precoPromocional:p.preco_promocional??undefined,
    variacoes:p.variacoes??[],
    adicionaisDisponiveis:p.produto_adicionais?.map((pa:any)=>pa.adicionais).filter(Boolean)??undefined
  }));
}
