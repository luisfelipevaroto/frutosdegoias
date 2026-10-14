import { supabase } from "./supabase";
import { getEmpresaAtual, dominioAtual, Empresa } from "./empresa";

export async function getEmpresaAdminAtual(userId: string): Promise<Empresa | null> {
  const empresa = await getEmpresaAtual();
  if (!empresa) {
    const own = await supabase.rpc('empresa_admin_por_dominio',{p_dominio:dominioAtual()});
    if(own.error||!own.data)return null;
    return own.data as Empresa;
  }
  const { data, error } = await supabase
    .from("admin_users")
    .select("empresa_id")
    .eq("user_id", userId)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (error || !data) return null;
  return empresa;
}
