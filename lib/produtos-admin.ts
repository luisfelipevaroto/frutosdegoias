import type { SupabaseClient } from "@supabase/supabase-js";
export type ProdutoAdmin = { id:string; categoria:string; subcategoria?:string|null; categoria_id?:string|null; subcategoria_id?:string|null; nome:string; descricao?:string|null; preco?:number|null; preco_promocional?:number|null; foto_url?:string|null; ativo:boolean; adicionais_gratis?:number; variacoes:{id:string;nome:string;preco:number}[]; produto_adicionais:{adicional_id:string}[] };
export const TAMANHO_PAGINA = 20;
export async function buscarProdutosAdmin(db: SupabaseClient, empresaId: string, busca: string, inicio: number) {
  let query = db.from("produtos").select("id,categoria,subcategoria,categoria_id,subcategoria_id,nome,descricao,foto_url,ativo,adicionais_gratis,preco,preco_promocional,variacoes(id,nome,preco),produto_adicionais(adicional_id)", {count:"exact"}).eq("empresa_id",empresaId);
  const termo = busca.trim().replace(/[\\%_]/g, "\\$&");
  if (termo) query = query.ilike("nome", `%${termo}%`);
  const {data,error,count} = await query.order("categoria").order("nome").order("id").range(inicio,inicio+TAMANHO_PAGINA-1);
  if(error) throw new Error("Não foi possível carregar os produtos. Tente novamente.");
  return {produtos:(data||[]) as ProdutoAdmin[],total:count};
}

