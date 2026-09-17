import { supabase } from "./supabase";
import { getEmpresaAtual, Empresa } from "./empresa";

export async function getEmpresaAdminAtual(userId: string): Promise<Empresa | null> {
  const empresa = await getEmpresaAtual();
  if (!empresa) return null;
  const { data, error } = await supabase
    .from("admin_users")
    .select("empresa_id")
    .eq("user_id", userId)
    .eq("empresa_id", empresa.id)
    .maybeSingle();
  if (error || !data) return null;
  return empresa;
}
