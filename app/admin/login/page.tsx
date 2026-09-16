"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault(); setLoading(true); setErro("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) { setErro(error?.message ?? "Não foi possível entrar."); setLoading(false); return; }
    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!admin) { await supabase.auth.signOut(); setErro("Este usuário não possui acesso ao painel."); setLoading(false); return; }
    router.replace("/admin");
  }

  return <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
    <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
      <h1 className="text-xl font-semibold mb-1">Painel Frutos de Goiás</h1>
      <p className="text-sm text-neutral-500 mb-6">Acesso administrativo</p>
      <label className="block text-sm mb-1">E-mail</label>
      <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-lg border p-3 mb-4" />
      <label className="block text-sm mb-1">Senha</label>
      <input required type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full rounded-lg border p-3 mb-4" />
      {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-brand-700 text-white py-3 disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button>
    </form>
  </main>;
}
