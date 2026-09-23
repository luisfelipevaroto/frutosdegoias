"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";

type Variacao = { id: string; nome: string; preco: number };
type Adicional = { id: string; nome: string; preco: number };
type Produto = { id: string; nome: string; preco: number | null; preco_promocional: number | null; foto_url?: string | null; categoria?: string | null; variacoes: Variacao[]; adicionais: Adicional[] };
type Item = { chave: string; produto_id: string; nome: string; variacao_id: string | null; variacao_nome?: string; adicionais: Adicional[]; quantidade: number; preco_base: number };
type Cliente = { id: string; nome: string; cpf: string; telefone: string; whatsapp?: string };
type EntregaCfg = { propria?: boolean; retirada?: boolean; taxa?: number; pedido_minimo?: number };
type PagamentoCfg = { dinheiro?: boolean; cartao_entrega?: boolean; pix_manual?: boolean; online?: boolean };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PDV() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todos");
  const [produtoModal, setProdutoModal] = useState<Produto | null>(null);
  const [variacaoModal, setVariacaoModal] = useState<Variacao | null>(null);
  const [adicionaisModal, setAdicionaisModal] = useState<Adicional[]>([]);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo] = useState("retirada");
  const [endereco, setEndereco] = useState("");
  const [taxa, setTaxa] = useState("0");
  const [pagamento, setPagamento] = useState("dinheiro");
  const [entregaCfg, setEntregaCfg] = useState<EntregaCfg>({ retirada: true });
  const [pagamentoCfg, setPagamentoCfg] = useState<PagamentoCfg>({ dinheiro: true, cartao_entrega: true, pix_manual: true });
  const [observacoes, setObservacoes] = useState("");
  const [troco, setTroco] = useState(false);
  const [trocoPara, setTrocoPara] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", cpf: "", telefone: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/admin/login");
      const e = await getEmpresaAdminAtual(user.id);
      if (!e) return setErro("Sem acesso a esta empresa.");
      setEmpresaId(e.id); setEmpresaNome(e.nome);
      const [pr, pa, ads, cfg] = await Promise.all([
        supabase.from("produtos").select("id,nome,preco,preco_promocional,foto_url,categoria,variacoes(id,nome,preco)").eq("empresa_id", e.id).eq("ativo", true).order("ordem").order("nome"),
        supabase.from("produto_adicionais").select("produto_id,adicional_id"),
        supabase.from("adicionais").select("id,nome,preco").eq("empresa_id", e.id).order("nome"),
        supabase.from("configuracoes_loja").select("chave,valor").eq("empresa_id", e.id).in("chave", ["entrega", "pagamentos"]),
      ]);
      if (pr.error) return setErro(pr.error.message);
      const rel = pa.data ?? [], adicionais = (ads.data ?? []) as Adicional[];
      setProdutos((pr.data ?? []).map((p: any) => ({ ...p, adicionais: adicionais.filter((a) => rel.some((r: any) => r.produto_id === p.id && r.adicional_id === a.id)) })) as Produto[]);
      const ec = (cfg.data?.find((x: any) => x.chave === "entrega")?.valor ?? { retirada: true }) as EntregaCfg;
      const pc = (cfg.data?.find((x: any) => x.chave === "pagamentos")?.valor ?? { dinheiro: true, cartao_entrega: true, pix_manual: true }) as PagamentoCfg;
      setEntregaCfg(ec); setPagamentoCfg(pc);
      const primeiroTipo = ec.retirada !== false ? "retirada" : ec.propria ? "entrega" : "retirada";
      setTipo(primeiroTipo); setTaxa(String(ec.taxa ?? 0));
      if (pc.dinheiro) setPagamento("dinheiro"); else if (pc.cartao_entrega) setPagamento("cartao"); else setPagamento("pix");
    })();
  }, [router]);

  useEffect(() => {
    if (!empresaId || buscaCliente.trim().length < 2) { setClientes([]); return; }
    const t = setTimeout(async () => {
      const q = buscaCliente.trim();
      const { data } = await supabase.from("clientes").select("id,nome,cpf,telefone,whatsapp").eq("empresa_id", empresaId).or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,telefone.ilike.%${q}%,whatsapp.ilike.%${q}%`).limit(8);
      setClientes((data ?? []) as Cliente[]);
    }, 250);
    return () => clearTimeout(t);
  }, [buscaCliente, empresaId]);

  const categorias = useMemo(() => ["todos", ...Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean) as string[]))], [produtos]);
  const lista = produtos.filter((p) => (categoria === "todos" || p.categoria === categoria) && p.nome.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const subtotal = useMemo(() => itens.reduce((s, i) => s + (i.preco_base + i.adicionais.reduce((a, x) => a + Number(x.preco), 0)) * i.quantidade, 0), [itens]);
  const total = subtotal + (tipo === "entrega" ? Number(taxa || 0) : 0);

  function abrirProduto(p: Produto) { setProdutoModal(p); setVariacaoModal(p.variacoes?.length === 1 ? p.variacoes[0] : null); setAdicionaisModal([]); }
  function alternarAdicional(a: Adicional) { setAdicionaisModal((xs) => xs.some((x) => x.id === a.id) ? xs.filter((x) => x.id !== a.id) : [...xs, a]); }
  function confirmarProduto() {
    if (!produtoModal) return;
    if (produtoModal.variacoes?.length && !variacaoModal) return setErro("Selecione uma variação.");
    const preco = variacaoModal ? Number(variacaoModal.preco) : Number(produtoModal.preco_promocional ?? produtoModal.preco ?? 0);
    const ids = adicionaisModal.map((a) => a.id).sort().join("-");
    const chave = `${produtoModal.id}-${variacaoModal?.id ?? "u"}-${ids}`;
    setItens((xs) => {
      const n = xs.findIndex((x) => x.chave === chave);
      if (n >= 0) return xs.map((x, i) => i === n ? { ...x, quantidade: x.quantidade + 1 } : x);
      return [...xs, { chave, produto_id: produtoModal.id, nome: produtoModal.nome, variacao_id: variacaoModal?.id ?? null, variacao_nome: variacaoModal?.nome, adicionais: adicionaisModal, quantidade: 1, preco_base: preco }];
    });
    setProdutoModal(null); setErro("");
  }
  function qtd(i: number, n: number) { setItens((xs) => n <= 0 ? xs.filter((_, x) => x !== i) : xs.map((x, k) => k === i ? { ...x, quantidade: n } : x)); }

  async function cadastrarCliente() {
    const cpf = novo.cpf.replace(/\D/g, ""), tel = novo.telefone.replace(/\D/g, "");
    if (!novo.nome.trim() || cpf.length !== 11 || tel.length < 10) return setErro("Informe nome, CPF e telefone válidos.");
    const { data, error } = await supabase.from("clientes").upsert({ empresa_id: empresaId, nome: novo.nome.trim(), cpf, telefone: tel, whatsapp: tel }, { onConflict: "empresa_id,cpf" }).select("id,nome,cpf,telefone,whatsapp").single();
    if (error) setErro(error.message); else { setCliente(data as Cliente); setNovo({ nome: "", cpf: "", telefone: "" }); setBuscaCliente(""); }
  }

  async function finalizar() {
    if (!itens.length) return setErro("Adicione produtos ao pedido.");
    if (tipo === "entrega" && !endereco.trim()) return setErro("Informe o endereço de entrega.");
    if (subtotal < Number(entregaCfg.pedido_minimo ?? 0)) return setErro(`O pedido mínimo é ${brl(Number(entregaCfg.pedido_minimo))}.`);
    if (pagamento === "dinheiro" && troco && Number(trocoPara) <= total) return setErro("O valor para troco deve ser maior que o total.");
    setSalvando(true); setErro("");
    const { data, error } = await supabase.rpc("criar_pedido_pdv", { p_empresa_id: empresaId, p_cliente_id: cliente?.id ?? null, p_tipo_entrega: tipo, p_endereco_entrega: tipo === "entrega" ? endereco : null, p_taxa_entrega: tipo === "entrega" ? Number(taxa || 0) : 0, p_forma_pagamento: pagamento, p_itens: itens.map((i) => ({ produto_id: i.produto_id, variacao_id: i.variacao_id, adicionais_ids: i.adicionais.map((a) => a.id), quantidade: i.quantidade })), p_observacoes: observacoes || null, p_precisa_troco: pagamento === "dinheiro" && troco, p_troco_para: pagamento === "dinheiro" && troco ? Number(trocoPara) : null });
    setSalvando(false);
    if (error) return setErro(error.message);
    alert(`Pedido #${data.numero} criado com sucesso.`); router.push("/admin/pedidos");
  }

  return <main className="min-h-screen bg-neutral-50 p-4"><div className="mx-auto max-w-7xl">
    <div className="mb-4"><Link href="/admin/pedidos" className="text-sm text-brand-700">← Voltar aos pedidos</Link><h1 className="mt-1 text-xl font-bold">PDV · {empresaNome}</h1><p className="text-sm text-neutral-500">Pedido de balcão, telefone ou atendimento presencial.</p></div>
    {erro && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
    <div className="grid gap-4 lg:grid-cols-[1fr_410px]"><section className="rounded-xl border bg-white p-4">
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." className="w-full rounded-lg border p-3" />
      <div className="my-3 flex gap-2 overflow-x-auto">{categorias.map((c) => <button key={c} onClick={() => setCategoria(c)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${categoria === c ? "bg-brand-700 text-white" : "border bg-white"}`}>{c === "todos" ? "Todos" : c}</button>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{lista.map((p) => <button key={p.id} onClick={() => abrirProduto(p)} className="overflow-hidden rounded-xl border bg-white text-left hover:border-brand-400">{p.foto_url ? <img src={p.foto_url} alt={p.nome} className="h-28 w-full object-cover" /> : <div className="flex h-28 items-center justify-center bg-neutral-100 text-xs text-neutral-400">Sem imagem</div>}<div className="p-3"><b className="block">{p.nome}</b><span className="text-sm text-brand-700">{p.variacoes?.length ? "Escolher opção" : brl(Number(p.preco_promocional ?? p.preco ?? 0))}</span></div></button>)}</div>
    </section><aside className="space-y-3">
      <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Cliente <span className="text-xs font-normal text-neutral-400">(opcional)</span></h2>{cliente ? <div className="mt-2 rounded-lg bg-green-50 p-3 text-sm"><b>{cliente.nome}</b><p>{cliente.cpf} · {cliente.whatsapp || cliente.telefone}</p><button onClick={() => setCliente(null)} className="mt-1 text-xs underline">Remover vínculo</button></div> : <><input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" className="mt-2 w-full rounded border p-2 text-sm" />{clientes.map((c) => <button key={c.id} onClick={() => { setCliente(c); setBuscaCliente(""); setClientes([]); }} className="block w-full border-b p-2 text-left text-sm"><b>{c.nome}</b><br /><span className="text-xs text-neutral-500">{c.cpf} · {c.whatsapp || c.telefone}</span></button>)}<details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand-700">+ Cadastrar cliente</summary><div className="mt-2 grid gap-2"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" className="rounded border p-2 text-sm" /><input value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} placeholder="CPF" className="rounded border p-2 text-sm" /><input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="Telefone/WhatsApp" className="rounded border p-2 text-sm" /><button onClick={cadastrarCliente} className="rounded border p-2 text-sm font-semibold">Cadastrar e vincular</button></div></details></>}</section>
      <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Pedido</h2>{itens.length === 0 ? <p className="mt-2 text-sm text-neutral-400">Nenhum item.</p> : itens.map((i, n) => { const unit = i.preco_base + i.adicionais.reduce((s, a) => s + Number(a.preco), 0); return <div key={i.chave} className="border-b py-2 text-sm"><div className="flex justify-between gap-2"><div><b>{i.nome}</b>{i.variacao_nome && <p className="text-xs text-neutral-500">{i.variacao_nome}</p>}{i.adicionais.length > 0 && <p className="text-xs text-neutral-500">+ {i.adicionais.map((a) => `${a.nome} (${brl(Number(a.preco))})`).join(", ")}</p>}<p>{brl(unit)}</p></div><div className="flex items-center gap-2"><button onClick={() => qtd(n, i.quantidade - 1)} className="h-7 w-7 rounded border">−</button><span>{i.quantidade}</span><button onClick={() => qtd(n, i.quantidade + 1)} className="h-7 w-7 rounded border">+</button></div></div></div>; })}
        <div className="mt-3 flex gap-2">{entregaCfg.retirada !== false && <button onClick={() => setTipo("retirada")} className={`flex-1 rounded border p-2 text-sm ${tipo === "retirada" ? "border-brand-600 bg-brand-50" : ""}`}>Retirada</button>}{entregaCfg.propria && <button onClick={() => { setTipo("entrega"); setTaxa(String(entregaCfg.taxa ?? 0)); }} className={`flex-1 rounded border p-2 text-sm ${tipo === "entrega" ? "border-brand-600 bg-brand-50" : ""}`}>Entrega</button>}</div>
        {tipo === "entrega" && <><input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço de entrega" className="mt-2 w-full rounded border p-2 text-sm" /><p className="mt-1 text-xs text-neutral-500">Taxa configurada: {brl(Number(taxa || 0))}</p></>}
        <div className="mt-3 grid gap-2">{pagamentoCfg.dinheiro && <button onClick={() => setPagamento("dinheiro")} className={`rounded border p-2 text-sm ${pagamento === "dinheiro" ? "border-brand-600 bg-brand-50" : ""}`}>Dinheiro</button>}{pagamentoCfg.cartao_entrega && <button onClick={() => setPagamento("cartao")} className={`rounded border p-2 text-sm ${pagamento === "cartao" ? "border-brand-600 bg-brand-50" : ""}`}>Cartão</button>}{(pagamentoCfg.pix_manual || pagamentoCfg.online) && <button onClick={() => setPagamento("pix")} className={`rounded border p-2 text-sm ${pagamento === "pix" ? "border-brand-600 bg-brand-50" : ""}`}>PIX</button>}</div>
        {pagamento === "dinheiro" && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={troco} onChange={(e) => setTroco(e.target.checked)} />Precisa de troco</label>}{pagamento === "dinheiro" && troco && <input type="number" step=".01" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Troco para R$" className="mt-2 w-full rounded border p-2 text-sm" />}
        <textarea maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações do pedido (opcional)" className="mt-2 min-h-20 w-full rounded border p-2 text-sm" />
        <div className="mt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>{tipo === "entrega" && <div className="flex justify-between"><span>Entrega</span><span>{brl(Number(taxa || 0))}</span></div>}<div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{brl(total)}</span></div></div>
        <button disabled={salvando || !itens.length} onClick={finalizar} className="mt-3 w-full rounded-lg bg-brand-700 p-3 font-semibold text-white disabled:opacity-40">{salvando ? "Criando pedido..." : "Criar pedido"}</button>
      </section></aside></div>
    {produtoModal && <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-2 sm:items-center sm:p-4" onClick={() => setProdutoModal(null)}><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white sm:max-h-[90vh]" onClick={(e) => e.stopPropagation()}><div className="shrink-0 border-b p-4 sm:p-5"><div className="flex justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-bold">{produtoModal.nome}</h2><p className="text-xs text-neutral-500">Configure o item</p></div><button onClick={() => setProdutoModal(null)} className="shrink-0 text-xl">×</button></div></div><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{produtoModal.variacoes?.length > 0 && <div><p className="mb-2 text-sm font-semibold">Variação</p><div className="grid gap-2">{produtoModal.variacoes.map((v) => <button key={v.id} onClick={() => setVariacaoModal(v)} className={`flex justify-between gap-3 rounded-lg border p-3 text-sm ${variacaoModal?.id === v.id ? "border-brand-600 bg-brand-50" : ""}`}><span className="text-left">{v.nome}</span><b className="shrink-0">{brl(Number(v.preco))}</b></button>)}</div></div>}{produtoModal.adicionais.length > 0 && <div className="mt-4"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Adicionais</p><span className="text-xs text-neutral-400">{adicionaisModal.length} selecionado{adicionaisModal.length === 1 ? "" : "s"}</span></div><div className="grid max-h-[38vh] gap-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-72">{produtoModal.adicionais.map((a) => <label key={a.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border p-3 text-sm"><span className="min-w-0"><input type="checkbox" checked={adicionaisModal.some((x) => x.id === a.id)} onChange={() => alternarAdicional(a)} className="mr-2" />{a.nome}</span><b className="shrink-0">+ {brl(Number(a.preco))}</b></label>)}</div></div>}</div><div className="shrink-0 border-t bg-white p-4 sm:p-5"><button onClick={confirmarProduto} className="w-full rounded-lg bg-brand-700 p-3 font-bold text-white">Adicionar ao pedido</button></div></div></div>}
  </div></main>;
}