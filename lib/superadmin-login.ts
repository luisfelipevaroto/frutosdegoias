import type { SupabaseClient } from "@supabase/supabase-js";

export async function entrarSuperadmin(client: SupabaseClient, email: string, senha: string) {
  const login = await client.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (login.error || !login.data.user) throw new Error("E-mail ou senha inválidos, ou serviço indisponível. Verifique os dados e tente novamente.");
  let permitido = false;
  try {
    const permission = await client.rpc("is_super_admin");
    if (permission.error) throw new Error("Não foi possível verificar sua permissão. Tente novamente.");
    if (permission.data !== true) throw new Error("Este usuário não possui acesso ao Superadmin.");
    permitido = true;
  } finally {
    // A valid merchant login alone does not grant platform access.
    if (!permitido) await client.auth.signOut({ scope: "local" });
  }
}
