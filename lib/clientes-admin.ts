import type { SupabaseClient } from "@supabase/supabase-js";

export type ClienteAdmin = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string;
  whatsapp: string | null;
  criado_em: string;
};
export const CLIENTES_POR_PAGINA = 50;

export async function buscarClientesAdmin(
  db: SupabaseClient,
  empresaId: string,
  busca: string,
  pagina: number,
) {
  if (!empresaId) throw new Error("Empresa não identificada.");
  const inicio = Math.max(0, Math.trunc(pagina)) * CLIENTES_POR_PAGINA;
  let consulta = db.from("clientes")
    .select("id,nome,cpf,telefone,whatsapp,criado_em", { count: "exact" })
    .eq("empresa_id", empresaId);
  const termo = busca.trim();
  if (termo) {
    const numeros = termo.replace(/\D/g, "");
    if (numeros && /^[\d\s()+.\-]+$/.test(termo)) {
      consulta = consulta.or(`nome.ilike.%${numeros}%,cpf.ilike.%${numeros}%,telefone.ilike.%${numeros}%,whatsapp.ilike.%${numeros}%`);
    } else {
      const nome = termo.replace(/[\\%_]/g, "\\$&");
      consulta = consulta.ilike("nome", `%${nome}%`);
    }
  }
  const { data, error, count } = await consulta.order("nome").order("id")
    .range(inicio, inicio + CLIENTES_POR_PAGINA - 1);
  if (error) throw new Error("Não foi possível carregar os clientes. Tente novamente.");
  return { clientes: (data ?? []) as ClienteAdmin[], total: count ?? 0 };
}
