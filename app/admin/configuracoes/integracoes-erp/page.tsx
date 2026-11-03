"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";

type Chave = { id: string; nome: string; prefixo: string; ativo: boolean; criado_em: string; revogado_em: string | null };
export default function IntegracoesErp() {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<{ id: string; nome: string } | null>(null);
  const [chaves, setChaves] = useState<Chave[]>([]);
  const [nome, setNome] = useState("");
  const [token, setToken] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarId, setConfirmarId] = useState<string | null>(null);

  const chamar = useCallback(async (empresaId: string, method = "GET", body?: object, id?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/admin/login"); throw new Error("Sessão expirada"); }
    const url = new URL("/api/admin/erp-chaves", window.location.origin);
    url.searchParams.set("empresa_id", empresaId);
    if (id) url.searchParams.set("id", id);
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Erro HTTP ${res.status}`);
    return json;
  }, [router]);

  const listar = useCallback(async (id: string) => {
    const data = await chamar(id);
    setChaves(data.data || []);
  }, [chamar]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/admin/login"); return; }
        const e = await getEmpresaAdminAtual(user.id);
        if (!e) throw new Error("Sem acesso administrativo a esta empresa");
        if (!ativo) return;
        setEmpresa({ id: e.id, nome: e.nome });
        await listar(e.id);
      } catch (e) { if (ativo) setErro(e instanceof Error ? e.message : "Falha ao carregar"); }
      finally { if (ativo) setCarregando(false); }
    })();
    return () => { ativo = false; };
  }, [listar, router]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!empresa || ocupado) return;
    setOcupado(true); setErro(""); setMensagem(""); setToken("");
    try {
      const data = await chamar(empresa.id, "POST", { nome: nome.trim() });
      setToken(data.token);
      setNome("");
      await listar(empresa.id);
      setMensagem("Chave criada. Copie agora: ela não poderá ser exibida novamente.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao gerar chave"); }
    finally { setOcupado(false); }
  }

  async function revogar(id: string) {
    if (!empresa || ocupado) return;
    setOcupado(true); setErro(""); setMensagem("");
    try {
      await chamar(empresa.id, "DELETE", undefined, id);
      setConfirmarId(null);
      await listar(empresa.id);
      setMensagem("Chave revogada. O ERP não poderá mais utilizá-la.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao revogar"); }
    finally { setOcupado(false); }
  }

  return <main className="min-h-screen bg-neutral-50 p-4 text-neutral-900">
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><Link href="/admin" className="text-sm text-brand-700">← Voltar ao painel</Link>
          <h1 className="mt-2 text-2xl font-bold">Configurações · Integrações ERP</h1>
          <p className="text-sm text-neutral-500">{empresa?.nome || "Carregando empresa..."}</p>
        </div>
      </div>
      <p className="rounded-lg border bg-white p-4 text-sm">Gere uma chave para conectar seu ERP à API de pedidos. Cada chave pertence exclusivamente a esta empresa. Limite de 5 chaves ativas; 60 requisições por minuto por chave.</p>
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {mensagem && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{mensagem}</p>}
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Gerar nova chave</h2>
        <form onSubmit={criar} className="flex flex-wrap gap-2">
          <input aria-label="Nome da integração" required maxLength={100} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: ERP da loja" className="min-w-48 flex-1 rounded-lg border p-3 text-sm"/>
          <button disabled={!empresa || ocupado || !nome.trim()} className="rounded-lg bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{ocupado ? "Aguarde..." : "Gerar chave"}</button>
        </form>
        {token && <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Atenção: a chave aparece uma única vez. Guarde-a no cofre de segredos do ERP.</p>
          <code className="block break-all rounded bg-white p-3 text-xs">{token}</code>
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(token); setMensagem("Chave copiada."); } catch { setErro("Não foi possível copiar automaticamente."); } }} className="mt-3 rounded border bg-white px-4 py-2 text-sm">Copiar chave</button>
          <button type="button" onClick={() => setToken("")} className="ml-2 mt-3 rounded border px-4 py-2 text-sm">Já guardei, ocultar</button>
        </div>}
      </section>
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Chaves cadastradas</h2>
        {carregando ? <p className="text-sm text-neutral-500">Carregando...</p> : chaves.length === 0 ? <p className="text-sm text-neutral-500">Nenhuma chave cadastrada.</p> :
          <div className="space-y-3">{chaves.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm">
            <div><strong>{c.nome}</strong><p className="text-neutral-500">Prefixo: {c.prefixo} · {new Date(c.criado_em).toLocaleDateString("pt-BR")}</p><span className={c.ativo && !c.revogado_em ? "text-green-700" : "text-neutral-500"}>{c.ativo && !c.revogado_em ? "Ativa" : "Revogada"}</span></div>
            {c.ativo && !c.revogado_em && (confirmarId === c.id ? <div className="flex gap-2"><button disabled={ocupado} onClick={() => revogar(c.id)} className="rounded bg-red-700 px-3 py-2 text-white">Confirmar revogação</button><button onClick={() => setConfirmarId(null)} className="rounded border px-3 py-2">Cancelar</button></div> : <button onClick={() => setConfirmarId(c.id)} className="rounded border border-red-300 px-3 py-2 text-red-700">Revogar</button>)}
          </div>)}</div>}
      </section>
    </div>
  </main>;
}
