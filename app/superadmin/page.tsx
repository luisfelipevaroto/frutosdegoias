"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardSuperadmin, EmpresaSuperadmin, ModuloSuperadmin, moduloEfetivo } from "@/lib/superadmin";
import Dashboard, { brl } from "@/components/superadmin/Dashboard";
import EmpresaDetalhes from "@/components/superadmin/EmpresaDetalhes";

const inputClass = "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";
type FormEmpresa = { nome: string; slug: string; dominio_principal: string; ativo: boolean; telefone: string; whatsapp: string; endereco: string; cidade: string; estado: string; cep: string };
const vazio: FormEmpresa = { nome: "", slug: "", dominio_principal: "", ativo: false, telefone: "", whatsapp: "", endereco: "", cidade: "", estado: "", cep: "" };
function formEmpresa(e: EmpresaSuperadmin): FormEmpresa {
  return { nome: e.nome, slug: e.slug, dominio_principal: e.dominio_principal || "", ativo: e.ativo, telefone: e.telefone || "", whatsapp: e.whatsapp || "", endereco: e.endereco || "", cidade: e.cidade || "", estado: e.estado || "", cep: e.cep || "" };
}

export default function SuperAdmin() {
  const router = useRouter();
  const [dados, setDados] = useState<DashboardSuperadmin | null>(null);
  const [aba, setAba] = useState<"dashboard" | "empresas">("dashboard");
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState(""), [sucesso, setSucesso] = useState("");
  const [busca, setBusca] = useState(""), [filtro, setFiltro] = useState("todas"), [planoFiltro, setPlanoFiltro] = useState("todos");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<EmpresaSuperadmin | "nova" | null>(null), [form, setForm] = useState<FormEmpresa>(vazio);
  const [salvando, setSalvando] = useState(false), [salvandoModulo, setSalvandoModulo] = useState("");
  const requestId = useRef(0), mutation = useRef(false);
  const carregar = useCallback(async () => {
    const request = ++requestId.current;
    setCarregando(true); setErro("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (request !== requestId.current) return;
      if (!session) { setDados(null); router.replace("/admin/login"); return; }
      const res = await fetch("/api/superadmin", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await res.json();
      if (request !== requestId.current) return;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setDados(null);
        if (res.status === 401) router.replace("/admin/login");
        throw new Error(payload.error || "Não foi possível carregar o painel.");
      }
      setDados(payload);
    } catch (error) { if (request === requestId.current) setErro(error instanceof Error ? error.message : "Não foi possível carregar o painel."); }
    finally { if (request === requestId.current) setCarregando(false); }
  }, [router]);
  useEffect(() => { carregar(); return () => { requestId.current++; }; }, [carregar]);
  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) { setErro("Não foi possível sair. Tente novamente."); return; }
    requestId.current++; setDados(null); router.replace("/admin/login");
  }
  function editar(e: EmpresaSuperadmin | "nova") { setEditando(e); setForm(e === "nova" ? { ...vazio } : formEmpresa(e)); setErro(""); setSucesso(""); }
  async function salvarEmpresa(event: FormEvent) {
    event.preventDefault();
    if (!editando || mutation.current) return;
    mutation.current = true; setSalvando(true); setErro(""); setSucesso("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/admin/login"); throw new Error("Sessão expirada."); }
      const res = await fetch("/api/superadmin", { method: editando === "nova" ? "POST" : "PATCH", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(editando === "nova" ? {} : { id: editando.id, atualizado_em: editando.atualizado_em }) }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Não foi possível salvar.");
      setSucesso(editando === "nova" ? "Empresa cadastrada. Configure o acesso administrativo, o plano e o catálogo para concluir a implantação." : "Dados da empresa salvos.");
      setEditando(null); setSelecionadaId(result.empresa.id); await carregar();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { mutation.current = false; setSalvando(false); }
  }
  async function alternarModulo(empresa: EmpresaSuperadmin, modulo: ModuloSuperadmin) {
    if (!dados || mutation.current) return;
    const ativo = !moduloEfetivo(empresa, modulo.id, dados.empresaModulos, dados.planoModulos).ativo;
    mutation.current = true; setSalvandoModulo(modulo.id); setErro(""); setSucesso("");
    try {
      const result = await supabase.rpc("super_admin_definir_modulo", { p_empresa_id: empresa.id, p_modulo_id: modulo.id, p_ativo: ativo });
      if (result.error || result.data !== true) throw new Error("Não foi possível alterar o módulo. Verifique sua permissão e tente novamente.");
      setDados(current => current ? { ...current, empresaModulos: [...current.empresaModulos.filter(x => !(x.empresa_id === empresa.id && x.modulo_id === modulo.id)), { empresa_id: empresa.id, modulo_id: modulo.id, ativo }] } : current);
      setSucesso(`${modulo.nome}: ${ativo ? "liberado" : "desativado"} para ${empresa.nome}.`);
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível alterar o módulo."); }
    finally { mutation.current = false; setSalvandoModulo(""); }
  }

  if (!dados) return <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-6"><div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-brand-700">Plataforma delivery</p><h1 className="mt-2 text-2xl font-bold">Superadmin 2.0</h1>{carregando ? <p className="mt-4 text-neutral-500" role="status">Carregando seu painel…</p> : <><p role="alert" className="mt-4 text-sm text-red-700">{erro || "Entre para acessar o painel."}</p><button onClick={carregar} className="mt-5 rounded-xl border px-4 py-2 text-sm">Tentar novamente</button><button onClick={() => router.push("/admin/login")} className="ml-2 rounded-xl bg-brand-700 px-4 py-2 text-sm text-white">Entrar</button></>}</div></main>;
  const selecionada = dados.empresas.find(e => e.id === selecionadaId) || null;
  const filtradas = dados.empresas.filter(e => `${e.nome} ${e.slug} ${e.dominio_principal || ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")) && (filtro === "todas" || (filtro === "ativas" ? e.ativo : !e.ativo)) && (planoFiltro === "todos" || (planoFiltro === "sem-plano" ? !e.plano_id : e.plano_id === planoFiltro)));
  const mesTexto = new Date(`${dados.mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  const bloqueado = carregando || salvando || !!salvandoModulo;
  return <main className="min-h-screen bg-[#f4f5f3] lg:pl-64">
    <aside className="border-b bg-[#14251e] text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0"><div className="p-5 lg:p-7"><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-emerald-300">Delivery SaaS</p><h1 className="mt-2 text-xl font-bold">Superadmin <span className="text-emerald-300">2.0</span></h1><p className="mt-1 text-xs text-neutral-400">Gestão da plataforma</p></div><nav aria-label="Superadmin" className="flex gap-2 px-4 pb-4 lg:flex-col lg:px-5">{([['dashboard', 'Visão geral'], ['empresas', 'Gestão de empresas']] as const).map(([id, nome]) => <button key={id} onClick={() => setAba(id)} aria-current={aba === id ? "page" : undefined} className={`rounded-xl px-4 py-3 text-left text-sm font-medium ${aba === id ? "bg-white/10 text-emerald-200" : "text-neutral-300 hover:bg-white/5"}`}>{nome}</button>)}</nav><div className="hidden border-t border-white/10 p-7 text-xs leading-relaxed text-neutral-400 lg:block">Uma visão de todas as empresas, recursos e integrações.</div></aside>
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-neutral-500">Plataforma / {aba === "dashboard" ? "Visão geral" : "Empresas"}</p><h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{aba === "dashboard" ? "Visão geral do negócio" : "Gestão de empresas"}</h2><p className="mt-2 text-sm text-neutral-500">{aba === "dashboard" ? `Acompanhe sua operação · ${mesTexto}` : "Organize lojas, dados cadastrais e recursos disponíveis."}</p></div><div className="flex gap-2"><button disabled={bloqueado || !!editando} onClick={carregar} className="rounded-xl border bg-white px-4 py-2.5 text-sm disabled:opacity-50">{carregando ? "Atualizando…" : "Atualizar"}</button><button disabled={bloqueado} onClick={sair} className="rounded-xl border bg-white px-4 py-2.5 text-sm disabled:opacity-50">Sair</button></div></header>
      {erro && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}
      {sucesso && <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{sucesso}</div>}
      {aba === "dashboard" ? <Dashboard dados={dados} abrirEmpresa={id => { setSelecionadaId(id); setAba("empresas"); }} /> : <>
        <section className="rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-xs font-semibold text-neutral-500">Buscar empresa<input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, identificador ou domínio" className={inputClass} /></label><label className="text-xs font-semibold text-neutral-500">Situação<select value={filtro} onChange={e => setFiltro(e.target.value)} className={inputClass}><option value="todas">Todas</option><option value="ativas">Ativas</option><option value="inativas">Inativas</option></select></label><label className="text-xs font-semibold text-neutral-500">Plano<select value={planoFiltro} onChange={e => setPlanoFiltro(e.target.value)} className={inputClass}><option value="todos">Todos</option><option value="sem-plano">Sem plano</option>{dados.planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label><button disabled={bloqueado || !!editando} onClick={() => editar("nova")} className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">+ Nova empresa</button></div></section>
        {editando && <section aria-label="Cadastro da empresa" className="mt-5 rounded-2xl border border-brand-200 bg-white p-5 md:p-6"><h3 className="text-lg font-bold">{editando === "nova" ? "Cadastrar empresa" : `Editar ${editando.nome}`}</h3>{editando === "nova" && <p className="mt-1 text-sm text-neutral-500">O cadastro começa sem plano. Configure o acesso administrativo e o catálogo para concluir a implantação.</p>}<form onSubmit={salvarEmpresa} className="mt-4"><fieldset disabled={salvando} className="grid gap-4 sm:grid-cols-2">{([['nome', 'Nome da empresa', 150], ['slug', 'Identificador (slug)', 80], ['dominio_principal', 'Domínio principal', 253], ['whatsapp', 'WhatsApp', 30], ['telefone', 'Telefone', 30], ['endereco', 'Endereço', 300], ['cidade', 'Cidade', 100], ['estado', 'Estado (UF)', 2], ['cep', 'CEP', 12]] as const).map(([key, label, max]) => <label key={key} className="text-xs font-semibold text-neutral-600">{label}<input required={key === "nome" || key === "slug"} maxLength={max} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inputClass} /></label>)}<label className="flex items-center gap-3 rounded-xl bg-neutral-50 p-3 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} />Empresa ativa para receber pedidos</label></fieldset><p className="mt-4 text-xs text-neutral-500">Desativar impede novos pedidos pela regra atual. Pedidos já existentes permanecem no histórico.</p><div className="mt-5 flex gap-2"><button disabled={salvando} className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{salvando ? "Salvando…" : "Salvar empresa"}</button><button type="button" disabled={salvando} onClick={() => setEditando(null)} className="rounded-xl border px-5 py-2.5 text-sm">Cancelar</button></div></form></section>}
        <section className="mt-5 overflow-hidden rounded-2xl border bg-white"><div className="border-b px-5 py-4 text-sm text-neutral-500">{filtradas.length} de {dados.empresas.length} empresas</div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr><th className="px-5 py-3">Empresa</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3">Plano</th><th className="px-4 py-3 text-right">GMV do mês</th><th className="px-5 py-3" aria-label="Ações" /></tr></thead><tbody>{filtradas.map(e => <tr key={e.id} className={`border-t ${selecionadaId === e.id ? "bg-brand-50" : "hover:bg-neutral-50"}`}><td className="px-5 py-4"><b className="block">{e.nome}</b><span className="text-xs text-neutral-500">{e.dominio_principal || e.slug}</span></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.ativo ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"}`}>{e.ativo ? "Ativa" : "Inativa"}</span>{(e.ativo && e.status !== "ativa") || (!e.ativo && e.status === "ativa") ? <span className="mt-1 block text-xs text-amber-700">Status cadastral: {e.status}</span> : null}</td><td className="px-4 py-4 text-neutral-600">{dados.planos.find(p => p.id === e.plano_id)?.nome || "Sem plano"}</td><td className="px-4 py-4 text-right font-semibold">{brl(dados.porEmpresa[e.id]?.gmvMes || 0)}</td><td className="px-5 py-4 text-right"><button disabled={bloqueado || !!editando} onClick={() => setSelecionadaId(e.id)} className="font-semibold text-brand-700 disabled:opacity-50">Gerenciar →</button></td></tr>)}</tbody></table></div>{!filtradas.length && <div className="p-8 text-center text-sm text-neutral-500">Nenhuma empresa encontrada para estes filtros.</div>}</section>
        {selecionada && <EmpresaDetalhes empresa={selecionada} dados={dados} bloqueado={bloqueado || !!editando} editar={() => editar(selecionada)} alternar={m => alternarModulo(selecionada, m)} />}
      </>}
      <footer className="mt-6 text-xs leading-relaxed text-neutral-500">Atualizado em {new Date(dados.atualizadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · Horário de São Paulo<br />GMV representa o volume dos pedidos das lojas; a receita das assinaturas será acompanhada separadamente.</footer>
    </div>
  </main>;
}
