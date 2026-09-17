"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Empresa, getEmpresaAtual } from "@/lib/empresa";

export default function AdminLogin() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { getEmpresaAtual().then(setEmpresa); }, []);

  async function entrar(e: FormEvent) {
    e.preventDefault(); setLoading(true); setErro("");
    const tenant = empresa ?? await getEmpresaAtual();
    if (!tenant) { setErro("Não foi possível identificar a empresa deste endereço."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error || !data.user) { setErro(error?.message ?? "Não foi possível entrar."); setLoading(false); return; }
    const { data: admin, error: acessoErro } = await supabase.from("admin_users").select("user_id").eq("user_id", data.user.id).eq("empresa_id", tenant.id).maybeSingle();
    if (acessoErro || !admin) { await supabase.auth.signOut(); setErro(`Este usuário não possui acesso ao painel de ${tenant.nome}.`); setLoading(false); return; }
    router.replace("/admin");
  }

  const primaria=empresa?.cor_primaria||"#166534";
  return <main className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
    <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm border border-neutral-200">
      <div className="mb-5 h-1.5 w-14 rounded-full" style={{backgroundColor:primaria}} />
      <h1 className="text-xl font-semibold mb-1">Painel {empresa?.nome ?? "Administrativo"}</h1>
      <p className="text-sm text-neutral-500 mb-6">Acesso administrativo</p>
      <label className="block text-sm mb-1">E-mail</label>
      <input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-lg border p-3 mb-4" />
      <label className="block text-sm mb-1">Senha</label>
      <input required type="password" value={senha} onChange={e=>setSenha(e.target.value)} className="w-full rounded-lg border p-3 mb-4" />
      {erro && <p className="text-sm text-red-600 mb-3">{erro}</p>}
      <button disabled={loading} style={{backgroundColor:primaria}} className="w-full rounded-lg text-white py-3 disabled:opacity-50">{loading ? "Entrando..." : "Entrar"}</button>
    </form>
  </main>;
}
