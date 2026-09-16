"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
};

const categorias = ["sorvete", "picole", "acai", "monte_do_jeito", "paleta"];

const categoriaLabels: Record<string, string> = {
  sorvete: "Sorvetes",
  picole: "Picolés",
  acai: "Açaí",
  monte_do_jeito: "Monte do seu jeito",
  paleta: "Paletas",
};

type VariacaoForm = { id?: string; nome: string; preco: string };

type ProdutoForm = {
  id?: string;
  categoria: string;
  subcategoria: string;
  nome: string;
  descricao: string;
  preco: string;
  preco_promocional: string;
  foto_url: string;
  ativo: boolean;
  variacoes: VariacaoForm[];
  adicionais: string[];
};

type Adicional = { id: string; nome: string; preco: number };

type Produto = {
  id: string;
  categoria: string;
  subcategoria?: string | null;
  nome: string;
  descricao?: string | null;
  preco?: number | null;
  preco_promocional?: number | null;
  foto_url?: string | null;
  ativo: boolean;
  variacoes: { id: string; nome: string; preco: number }[];
  produto_adicionais: { adicional_id: string; adicionais: Adicional | null }[];
};

const vazio: ProdutoForm = {
  categoria: "sorvete",
  subcategoria: "",
  nome: "",
  descricao: "",
  preco: "",
  preco_promocional: "",
  foto_url: "",
  ativo: true,
  variacoes: [],
  adicionais: [],
};

export default function Admin() {
  const router = useRouter();
  const [tab, setTab] = useState<"dashboard" | "pedidos" | "produtos" | "adicionais">("dashboard");
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<ProdutoForm>(vazio);
  const [novoAdicional, setNovoAdicional] = useState({ nome: "", preco: "" });

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/admin/login");
      return;
    }

    const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) {
      await supabase.auth.signOut();
      router.replace("/admin/login");
      return;
    }

    const [p, o, a] = await Promise.all([
      supabase
        .from("produtos")
        .select("id,categoria,subcategoria,nome,descricao,foto_url,ativo,preco,preco_promocional,variacoes(id,nome,preco),produto_adicionais(adicional_id,adicionais(id,nome,preco))")
        .order("categoria")
        .order("nome"),
      supabase.from("pedidos").select("*, clientes(nome,telefone)").order("criado_em", { ascending: false }).limit(100),
      supabase.from("adicionais").select("id,nome,preco").order("nome"),
    ]);

    setProdutos((p.data ?? []) as Produto[]);
    setPedidos(o.data ?? []);
    setAdicionais((a.data ?? []) as Adicional[]);
    if (p.error || o.error || a.error) setErro(p.error?.message || o.error?.message || a.error?.message || "");
  }

  useEffect(() => {
    carregar();
    const ch = supabase.channel("admin-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, carregar).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const hoje = useMemo(() => {
    const d = new Date();
    return pedidos.filter((p) => new Date(p.criado_em).toDateString() === d.toDateString());
  }, [pedidos]);

  const faturamento = hoje.reduce((s, p) => s + Number(p.valor_total || 0), 0);

  function editarProduto(p: Produto) {
    setErro("");
    setForm({
      id: p.id,
      categoria: p.categoria,
      subcategoria: p.subcategoria ?? "",
      nome: p.nome,
      descricao: p.descricao ?? "",
      preco: p.preco != null ? String(p.preco) : "",
      preco_promocional: p.preco_promocional != null ? String(p.preco_promocional) : "",
      foto_url: p.foto_url ?? "",
      ativo: p.ativo,
      variacoes: p.variacoes.map((v) => ({ id: v.id, nome: v.nome, preco: String(v.preco) })),
      adicionais: p.produto_adicionais.map((x) => x.adicional_id),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function adicionarVariacao() {
    setForm((f) => ({ ...f, variacoes: [...f.variacoes, { nome: "", preco: "" }] }));
  }

  function atualizarVariacao(index: number, campo: keyof VariacaoForm, valor: string) {
    setForm((f) => ({ ...f, variacoes: f.variacoes.map((v, i) => i === index ? { ...v, [campo]: valor } : v) }));
  }

  function removerVariacao(index: number) {
    setForm((f) => ({ ...f, variacoes: f.variacoes.filter((_, i) => i !== index) }));
  }

  function alternarAdicional(id: string) {
    setForm((f) => ({ ...f, adicionais: f.adicionais.includes(id) ? f.adicionais.filter((x) => x !== id) : [...f.adicionais, id] }));
  }

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);

    const payload = {
      categoria: form.categoria,
      subcategoria: form.subcategoria.trim() || null,
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      preco: form.preco ? Number(form.preco) : null,
      preco_promocional: form.preco_promocional ? Number(form.preco_promocional) : null,
      foto_url: form.foto_url.trim() || null,
      ativo: form.ativo,
    };

    if (!payload.nome) {
      setErro("Informe o nome do produto.");
      setSalvando(false);
      return;
    }

    const produtoResult = form.id
      ? await supabase.from("produtos").update(payload).eq("id", form.id).select("id").single()
      : await supabase.from("produtos").insert(payload).select("id").single();

    if (produtoResult.error || !produtoResult.data) {
      setErro(produtoResult.error?.message || "Não foi possível salvar o produto.");
      setSalvando(false);
      return;
    }

    const produtoId = produtoResult.data.id;

    const variacoesValidas = form.variacoes.filter((v) => v.nome.trim() && v.preco !== "");
    if (form.id) {
      const delVar = await supabase.from("variacoes").delete().eq("produto_id", produtoId);
      if (delVar.error) { setErro(delVar.error.message); setSalvando(false); return; }
      const delLinks = await supabase.from("produto_adicionais").delete().eq("produto_id", produtoId);
      if (delLinks.error) { setErro(delLinks.error.message); setSalvando(false); return; }
    }

    if (variacoesValidas.length) {
      const vr = await supabase.from("variacoes").insert(variacoesValidas.map((v) => ({ produto_id: produtoId, nome: v.nome.trim(), preco: Number(v.preco) })));
      if (vr.error) { setErro(vr.error.message); setSalvando(false); return; }
    }

    if (form.adicionais.length) {
      const ar = await supabase.from("produto_adicionais").insert(form.adicionais.map((id) => ({ produto_id: produtoId, adicional_id: id })));
      if (ar.error) { setErro(ar.error.message); setSalvando(false); return; }
    }

    setForm(vazio);
    setSalvando(false);
    await carregar();
  }

  async function desativarProduto(id: string) {
    if (!confirm("Desativar este produto? Ele deixará de aparecer no cardápio, mas continuará salvo.")) return;
    const { error } = await supabase.from("produtos").update({ ativo: false }).eq("id", id);
    if (error) setErro(error.message); else await carregar();
  }

  async function ativarProduto(id: string) {
    const { error } = await supabase.from("produtos").update({ ativo: true }).eq("id", id);
    if (error) setErro(error.message); else await carregar();
  }

  async function salvarAdicional(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!novoAdicional.nome.trim()) return;
    const { error } = await supabase.from("adicionais").insert({ nome: novoAdicional.nome.trim(), preco: Number(novoAdicional.preco || 0) });
    if (error) setErro(error.message); else { setNovoAdicional({ nome: "", preco: "" }); await carregar(); }
  }

  async function excluirAdicional(id: string) {
    if (!confirm("Excluir este adicional? Se estiver vinculado a algum produto, remova o vínculo primeiro.")) return;
    const { error } = await supabase.from("adicionais").delete().eq("id", id);
    if (error) setErro(error.message); else await carregar();
  }

  async function status(id: string, statusPedido: string) {
    const { error } = await supabase.from("pedidos").update({ status_pedido: statusPedido }).eq("id", id);
    if (error) setErro(error.message); else await carregar();
  }

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const produtosAtivos = produtos.filter((p) => p.ativo).length;

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div><h1 className="font-bold">Frutos de Goiás · Admin</h1><p className="text-xs text-neutral-500">Gestão da unidade Juiz de Fora</p></div>
          <button onClick={sair} className="text-sm text-neutral-500">Sair</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 text-sm">
          {(["dashboard", "pedidos", "produtos", "adicionais"] as const).map((x) => <button key={x} onClick={() => setTab(x)} className={`whitespace-nowrap border-b-2 py-3 ${tab === x ? "border-brand-700 text-brand-700" : "border-transparent text-neutral-500"}`}>{x === "dashboard" ? "Dashboard" : x[0].toUpperCase() + x.slice(1)}</button>)}
        </nav>
      </header>

      <section className="mx-auto max-w-6xl p-4">
        {erro && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        {tab === "dashboard" && <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Card t="Pedidos hoje" v={hoje.length} /><Card t="Faturamento hoje" v={`R$ ${faturamento.toFixed(2)}`} /><Card t="Em andamento" v={pedidos.filter((p) => p.status_pedido !== "entregue").length} /><Card t="Produtos ativos" v={produtosAtivos} /></div>
          <div className="mt-6 rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Pedidos recentes</h2>{pedidos.slice(0, 8).map((p) => <Order key={p.id} p={p} onStatus={status} />)}</div>
        </>}

        {tab === "pedidos" && <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Pedidos</h2>{pedidos.map((p) => <Order key={p.id} p={p} onStatus={status} />)}</div>}

        {tab === "produtos" && <div className="grid gap-5 lg:grid-cols-[430px_1fr]">
          <form onSubmit={salvarProduto} className="h-fit rounded-xl border bg-white p-4">
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">{form.id ? "Editar produto" : "Novo produto"}</h2><p className="text-xs text-neutral-500">Cadastre preço, variações e adicionais.</p></div>{form.id && <button type="button" onClick={() => setForm(vazio)} className="text-xs text-neutral-500">Novo</button>}</div>
            <label className="mb-1 block text-xs font-medium">Categoria</label>
            <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="mb-3 w-full rounded-lg border p-2">{categorias.map((c) => <option key={c} value={c}>{categoriaLabels[c]}</option>)}</select>
            <label className="mb-1 block text-xs font-medium">Subcategoria <span className="font-normal text-neutral-400">(opcional)</span></label>
            <input placeholder="Ex.: sabores, potes, cafés..." value={form.subcategoria} onChange={(e) => setForm({ ...form, subcategoria: e.target.value })} className="mb-3 w-full rounded-lg border p-2" />
            <label className="mb-1 block text-xs font-medium">Nome</label>
            <input required placeholder="Nome do produto" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mb-3 w-full rounded-lg border p-2" />
            <label className="mb-1 block text-xs font-medium">Descrição</label>
            <textarea placeholder="Descrição que aparecerá no cardápio" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="mb-3 min-h-20 w-full rounded-lg border p-2" />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="mb-1 block text-xs font-medium">Preço base</label><input type="number" min="0" step="0.01" placeholder="0,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="w-full rounded-lg border p-2" /></div>
              <div><label className="mb-1 block text-xs font-medium">Preço promocional</label><input type="number" min="0" step="0.01" placeholder="Opcional" value={form.preco_promocional} onChange={(e) => setForm({ ...form, preco_promocional: e.target.value })} className="w-full rounded-lg border p-2" /></div>
            </div>
            <label className="mb-1 mt-3 block text-xs font-medium">URL da foto</label>
            <input type="url" placeholder="https://..." value={form.foto_url} onChange={(e) => setForm({ ...form, foto_url: e.target.value })} className="w-full rounded-lg border p-2" />
            {form.foto_url && <div className="relative mt-2 h-36 overflow-hidden rounded-lg bg-neutral-100"><Image src={form.foto_url} alt="Prévia do produto" fill className="object-cover" unoptimized /></div>}

            <div className="mt-5 border-t pt-4"><div className="mb-2 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Variações</h3><p className="text-xs text-neutral-500">Ex.: 300 ml, 500 ml, 1 litro.</p></div><button type="button" onClick={adicionarVariacao} className="rounded-lg border px-3 py-1.5 text-xs">+ Variação</button></div>
              {form.variacoes.length === 0 && <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">Sem variações. O preço base será usado.</p>}
              <div className="space-y-2">{form.variacoes.map((v, i) => <div key={i} className="flex gap-2"><input placeholder="Nome" value={v.nome} onChange={(e) => atualizarVariacao(i, "nome", e.target.value)} className="min-w-0 flex-1 rounded-lg border p-2 text-sm" /><input type="number" min="0" step="0.01" placeholder="Preço" value={v.preco} onChange={(e) => atualizarVariacao(i, "preco", e.target.value)} className="w-28 rounded-lg border p-2 text-sm" /><button type="button" onClick={() => removerVariacao(i)} className="px-2 text-red-600">×</button></div>)}</div>
            </div>

            <div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">Adicionais disponíveis</h3><p className="mb-2 text-xs text-neutral-500">Selecione os adicionais que o cliente poderá escolher.</p>{adicionais.length === 0 ? <p className="rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">Nenhum adicional cadastrado. Crie-os na aba Adicionais.</p> : <div className="max-h-48 space-y-1 overflow-y-auto">{adicionais.map((a) => <label key={a.id} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-neutral-50"><span>{a.nome}</span><span className="flex items-center gap-2"><span className="text-xs text-neutral-500">R$ {Number(a.preco).toFixed(2)}</span><input type="checkbox" checked={form.adicionais.includes(a.id)} onChange={() => alternarAdicional(a.id)} /></span></label>)}</div>}</div>

            <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Produto disponível no cardápio</label>
            <button disabled={salvando} className="mt-4 w-full rounded-lg bg-brand-700 py-2.5 font-medium text-white disabled:opacity-50">{salvando ? "Salvando..." : "Salvar produto"}</button>
            {form.id && <button type="button" onClick={() => setForm(vazio)} className="mt-2 w-full rounded-lg border py-2">Cancelar edição</button>}
          </form>

          <div className="space-y-2">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Catálogo ({produtos.length})</h2><span className="text-xs text-neutral-500">{produtosAtivos} ativos</span></div>
            {produtos.map((p) => <div key={p.id} className="flex gap-3 rounded-xl border bg-white p-3"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">{p.foto_url ? <Image src={p.foto_url} alt={p.nome} fill className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-2xl">🍨</div>}</div><div className="min-w-0 flex-1"><div className="font-medium">{p.nome}</div><div className="text-xs text-neutral-500">{categoriaLabels[p.categoria] ?? p.categoria}{p.subcategoria ? ` · ${p.subcategoria}` : ""} · {p.ativo ? "Ativo" : "Inativo"}</div><div className="mt-1 text-sm">{p.variacoes.length ? `${p.variacoes.length} variações` : `R$ ${Number(p.preco ?? 0).toFixed(2)}`}{p.produto_adicionais.length ? ` · ${p.produto_adicionais.length} adicionais` : ""}</div></div><div className="flex shrink-0 items-center gap-2"><button onClick={() => editarProduto(p)} className="rounded-lg border px-3 py-2 text-sm">Editar</button>{p.ativo ? <button onClick={() => desativarProduto(p.id)} className="text-sm text-red-600">Desativar</button> : <button onClick={() => ativarProduto(p.id)} className="text-sm text-green-700">Ativar</button>}</div></div>)}
          </div>
        </div>}

        {tab === "adicionais" && <div className="grid gap-5 md:grid-cols-[360px_1fr]">
          <form onSubmit={salvarAdicional} className="h-fit rounded-xl border bg-white p-4"><h2 className="mb-1 font-semibold">Novo adicional</h2><p className="mb-4 text-xs text-neutral-500">Ex.: leite em pó, granola, banana.</p><input required placeholder="Nome" value={novoAdicional.nome} onChange={(e) => setNovoAdicional({ ...novoAdicional, nome: e.target.value })} className="mb-2 w-full rounded-lg border p-2" /><input type="number" min="0" step="0.01" placeholder="Preço" value={novoAdicional.preco} onChange={(e) => setNovoAdicional({ ...novoAdicional, preco: e.target.value })} className="mb-3 w-full rounded-lg border p-2" /><button className="w-full rounded-lg bg-brand-700 py-2 text-white">Cadastrar adicional</button></form>
          <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">Adicionais cadastrados</h2>{adicionais.map((a) => <div key={a.id} className="flex items-center justify-between border-t py-3"><div><div className="font-medium">{a.nome}</div><div className="text-sm text-neutral-500">R$ {Number(a.preco).toFixed(2)}</div></div><button onClick={() => excluirAdicional(a.id)} className="text-sm text-red-600">Excluir</button></div>)}</div>
        </div>}
      </section>
    </main>
  );
}

function Card({ t, v }: { t: string; v: any }) { return <div className="rounded-xl border bg-white p-4"><div className="text-xs text-neutral-500">{t}</div><div className="mt-1 text-xl font-bold">{v}</div></div>; }

function Order({ p, onStatus }: { p: any; onStatus: (id: string, status: string) => void }) {
  return <div className="flex flex-col gap-3 border-t py-3 md:flex-row md:items-center"><div className="flex-1"><b>#{p.numero}</b> · {p.clientes?.nome ?? "Cliente"}<div className="text-xs text-neutral-500">{p.clientes?.telefone ?? ""} · {p.tipo_entrega} · {p.forma_pagamento}</div></div><b>R$ {Number(p.valor_total || 0).toFixed(2)}</b><select value={p.status_pedido} onChange={(e) => onStatus(p.id, e.target.value)} className="rounded-lg border p-2 text-sm">{Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>;
}
