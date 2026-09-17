import { supabase } from "./supabase";

export type Empresa = {
  id: string;
  nome: string;
  slug: string;
  dominio_principal?: string | null;
  logo_url?: string | null;
  cor_primaria?: string | null;
  cor_secundaria?: string | null;
  whatsapp?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  configuracoes?: Record<string, unknown>;
};

export const EMPRESA_STORAGE_KEY = "frutos_empresa";
const DOMINIO_PADRAO = "frutos-de-goias-jf.vercel.app";

export function dominioAtual() {
  if (typeof window === "undefined") return DOMINIO_PADRAO;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" ? DOMINIO_PADRAO : host;
}

export async function getEmpresaAtual(): Promise<Empresa | null> {
  const dominio = dominioAtual();
  const { data, error } = await supabase.rpc("empresa_por_dominio", { p_dominio: dominio });
  if (error) { console.error("Erro ao identificar empresa:", error.message); return null; }
  const empresa = Array.isArray(data) ? data[0] : data;
  if (empresa && typeof window !== "undefined") localStorage.setItem(EMPRESA_STORAGE_KEY, JSON.stringify(empresa));
  return empresa ?? null;
}

export function empresaSalva(): Empresa | null {
  if (typeof window === "undefined") return null;
  try { const raw=localStorage.getItem(EMPRESA_STORAGE_KEY); return raw?JSON.parse(raw):null; } catch { return null; }
}
