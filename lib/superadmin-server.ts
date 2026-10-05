import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function resposta(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

// Validate the caller using their token before constructing the privileged client.
export async function autorizarSuperadmin(req: Request): Promise<{ db: SupabaseClient; userId: string } | NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth || !/^Bearer \S+$/i.test(auth)) return resposta({ error: "Sessão administrativa não encontrada." }, 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return resposta({ error: "Painel indisponível. Verifique a configuração do servidor." }, 503);
  const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await caller.auth.getUser(auth.slice(7));
  if (error || !user) return resposta({ error: "Sessão expirada. Entre novamente." }, 401);
  const permission = await caller.rpc("is_super_admin");
  if (permission.error) return resposta({ error: "Não foi possível verificar sua permissão. Tente novamente." }, 503);
  if (permission.data !== true) return resposta({ error: "Seu usuário não possui acesso ao Superadmin." }, 403);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return resposta({ error: "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para habilitar o Superadmin 2.0." }, 503);
  return { db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), userId: user.id };
}

// Do not assume the project uses the default 1,000-row API limit.
export async function paginar<T>(buscar: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, consumir?: (rows: T[]) => void) {
  const rows: T[] = [];
  for (let inicio = 0; ; ) {
    const result = await buscar(inicio, inicio + 999);
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) return rows;
    if (consumir) consumir(result.data); else rows.push(...result.data);
    inicio += result.data.length;
  }
}

