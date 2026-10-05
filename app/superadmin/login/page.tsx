"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { entrarSuperadmin } from "@/lib/superadmin-login";

export default function SuperadminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState(""), [senha, setSenha] = useState("");
  const [erro, setErro] = useState(""), [loading, setLoading] = useState(false);
  const enviando = useRef(false);
  async function entrar(event: FormEvent) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true; setLoading(true); setErro("");
    try { await entrarSuperadmin(supabase, email, senha); router.replace("/superadmin"); }
    catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente."); }
    finally { enviando.current = false; setLoading(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#14251e] p-4">
    <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Plataforma delivery</p>
      <h1 className="mt-2 text-2xl font-semibold">Superadmin 2.0</h1>
      <p className="mb-6 mt-2 text-sm text-neutral-500">Entre para gerenciar as empresas da plataforma.</p>
      <label htmlFor="superadmin-email" className="mb-1 block text-sm">E-mail</label>
      <input id="superadmin-email" required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className="mb-4 w-full rounded-lg border p-3" />
      <label htmlFor="superadmin-senha" className="mb-1 block text-sm">Senha</label>
      <input id="superadmin-senha" required type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} disabled={loading} className="mb-4 w-full rounded-lg border p-3" />
      {erro && <p role="alert" className="mb-3 text-sm text-red-700">{erro}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-brand-700 py-3 text-white disabled:opacity-50">{loading ? "Entrando…" : "Entrar no Superadmin"}</button>
      <Link href="/admin/login" className="mt-5 block text-center text-xs text-neutral-500">Acesso ao painel de uma loja</Link>
    </form>
  </main>;
}

