"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";

type Produto = {
  id: string;
  nome: string;
  preco: number | null;
  preco_promocional: number | null;
  variacoes: { id: string; nome: string; preco: number }[];
};
type Item = { produto_id: string; nome: string; variacao_id: string | null; variacao_nome?: string; quantidade: number; preco: number };
type Cliente = { id: string; nome: string; cpf: string; telefone: string; whatsapp?: string };

export default function PDV() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [tipo, setTipo] = useState("retirada");
  const [endereco, setEndereco] = useState("");
  const [taxa, setTaxa] = useState("0");
  const [pagamento, setPagamento] = useState("dinheiro");
  const [observacoes, setObservacoes] = useState("");
  const [troco, setTroco] = useState(false);
  const [trocoPara, setTrocoPara] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", cpf: "", telefone: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      const e = await getEmpresaAdminAtual(user.id);
      if (!e) {
        setErro("Sem acesso a esta empresa.");
        return;
      }
      setEmpresaId(e.id);
      setEmpresaNome(e.nome);
      const { data, error } = await supabase
        .from("produtos")
        .select("id,nome,preco,preco_promocional,variacoes(id,nome,preco)")
        .eq("empresa_id", e.id)
        .eq("ativo", true)
        .order("nome");
      if (error) setErro(error.message);
      else setProdutos((data ?? []) as Produto[]);
    })();
  }, [router]);

  useEffect(() => {
    if (!empresaId || buscaCliente.trim().length < 2) {
      setClientes([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = buscaCliente.trim();
      const { data } = await supabase
        .from("clientes")
        .select("id,nome,cpf,telefone,whatsapp")
        .eq("empresa_id", empresaId)
        .or(`nome.ilike.%${q}%,cpf.ilike.%${q}%,telefone.ilike.%${q}%,whatsapp.ilike.%${q}%`)
        .limit(8);
      setClientes((data ?? []) as Cliente[]);
    }, 250);
    return () => clearTimeout(t);
  }, [buscaCliente, empresaId]);

  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.preco * i.quantidade, 0), [itens]);
  const total = subtotal + (tipo === "entrega" ? Number(taxa || 0) : 0);
  const lista = produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  function add(p: Produto, v?: { id: string; nome: string; preco: number }) {
    const vid = v?.id ?? null;
    const key = `${p.id}-${vid ?? "u"}`;
    setItens((xs) => {
      const n = xs.findIndex((x) => `${x.produto_id}-${x.variacao_id ?? "u"}` === key);
      if (n >= 0) return xs.map((x, i) => i === n ? { ...x, quantidade: x.quantidade + 1 } : x);
      return [...xs, { produto_id: p.id, nome: p.nome, variacao_id: vid, variacao_nome: v?.nome, quantidade: 1, preco: v?.preco ?? Number(p.preco_promocional ?? p.preco ?? 0) }];
    });
  }

  function qtd(i: number, n: number) {
    setItens((xs) => n <= 0 ? xs.filter((_, x) => x !== i) : xs.map((x, k) => k === i ? { ...x, quantidade: n } : x));
  }

  async function cadastrarCliente() {
    const cpf = novo.cpf.replace(/\D/g, "");
    const tel = novo.telefone.replace(/\D/g, "");
    if (!novo.nome.trim() || cpf.length !== 11 || tel.length < 10) {
      setErro("Informe nome, CPF e telefone válidos.");
      return;
    }
    const { data, error } = await supabase
      .from("clientes")
      .upsert({ empresa_id: empresaId, nome: novo.nome.trim(), cpf, telefone: tel, whatsapp: tel }, { onConflict: "empresa_id,cpf" })
      .select("id,nome,cpf,telefone,whatsapp")
      .single();
    if (error) setErro(error.message);
    else {
      setCliente(data as Cliente);
      setNovo({ nome: "", cpf: "", telefone: "" });
      setBuscaCliente("");
    }
  }

  async function finalizar() {
    if (!itens.length) return setErro("Adicione produtos ao pedido.");
    if (tipo === "entrega" && !endereco.trim()) return setErro("Informe o endereço de entrega.");
    if (pagamento === "dinheiro" && troco && Number(trocoPara) <= total) return setErro("O valor para troco deve ser maior que o total.");
    setSalvando(true);
    setErro("");
    const { data, error } = await supabase.rpc("criar_pedido_pdv", {
      p_empresa_id: empresaId,
      p_cliente_id: cliente?.id ?? null,
      p_tipo_entrega: tipo,
      p_endereco_entrega: tipo === "entrega" ? endereco : null,
      p_taxa_entrega: tipo === "entrega" ? Number(taxa || 0) : 0,
      p_forma_pagamento: pagamento,
      p_itens: itens.map((i) => ({ produto_id: i.produto_id, variacao_id: i.variacao_id, adicionais_ids: [], quantidade: i.quantidade })),
      p_observacoes: observacoes || null,
      p_precisa_troco: pagamento === "dinheiro" && troco,
      p_troco_para: pagamento === "dinheiro" && troco ? Number(trocoPara) : null,
    });
    setSalvando(false);
    if (error) return setErro(error.message);
    alert(`Pedido #${data.numero} criado com sucesso.`);
    router.push("/admin/pedidos");
  }

  return (
    <main className="min-h-screen bg-neutral-50 p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-brand-700">← Voltar ao painel</Link>
            <h1 className="mt-1 text-xl font-bold">PDV · {empresaNome}</h1>
            <p className="text-sm text-neutral-500">Crie pedidos de balcão, telefone ou atendimento presencial.</p>
          </div>
        </div>
        {erro && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
        <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
          <section className="rounded-xl border bg-white p-4">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto..." className="mb-4 w-full rounded-lg border p-3" />
            <div className="grid gap-2 sm:grid-cols-2">
              {lista.map((p) => (
                <div key={p.id} className="rounded-lg border p-3">
                  <b>{p.nome}</b>
                  {p.variacoes?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.variacoes.map((v) => <button key={v.id} onClick={() => add(p, v)} className="rounded border px-2 py-1 text-xs">{v.nome} · R$ {Number(v.preco).toFixed(2)}</button>)}
                    </div>
                  ) : (
                    <button onClick={() => add(p)} className="mt-2 block rounded bg-brand-700 px-3 py-2 text-xs font-semibold text-white">Adicionar · R$ {Number(p.preco_promocional ?? p.preco ?? 0).toFixed(2)}</button>
                  )}
                </div>
              ))}
            </div>
          </section>
          <aside className="space-y-3">
            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Cliente <span className="text-xs font-normal text-neutral-400">(opcional)</span></h2>
              {cliente ? (
                <div className="mt-2 rounded-lg bg-green-50 p-3 text-sm">
                  <b>{cliente.nome}</b><p>{cliente.cpf} · {cliente.whatsapp || cliente.telefone}</p>
                  <button onClick={() => setCliente(null)} className="mt-1 text-xs underline">Remover vínculo</button>
                </div>
              ) : (
                <>
                  <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" className="mt-2 w-full rounded border p-2 text-sm" />
                  {clientes.map((c) => <button key={c.id} onClick={() => { setCliente(c); setBuscaCliente(""); setClientes([]); }} className="block w-full border-b p-2 text-left text-sm"><b>{c.nome}</b><br /><span className="text-xs text-neutral-500">{c.cpf} · {c.whatsapp || c.telefone}</span></button>)}
                  <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-brand-700">+ Cadastrar cliente</summary><div className="mt-2 grid gap-2"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome" className="rounded border p-2 text-sm" /><input value={novo.cpf} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} placeholder="CPF" className="rounded border p-2 text-sm" /><input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="Telefone/WhatsApp" className="rounded border p-2 text-sm" /><button onClick={cadastrarCliente} className="rounded border p-2 text-sm font-semibold">Cadastrar e vincular</button></div></details>
                </>
              )}
            </section>
            <section className="rounded-xl border bg-white p-4">
              <h2 className="font-semibold">Pedido</h2>
              {itens.length === 0 ? <p className="mt-2 text-sm text-neutral-400">Nenhum item.</p> : itens.map((i, n) => <div key={n} className="flex items-center justify-between border-b py-2 text-sm"><div><b>{i.nome}</b>{i.variacao_nome && <p className="text-xs text-neutral-500">{i.variacao_nome}</p>}<p>R$ {i.preco.toFixed(2)}</p></div><div className="flex items-center gap-2"><button onClick={() => qtd(n, i.quantidade - 1)} className="h-7 w-7 rounded border">−</button><span>{i.quantidade}</span><button onClick={() => qtd(n, i.quantidade + 1)} className="h-7 w-7 rounded border">+</button></div></div>)}
              <div className="mt-3 flex gap-2"><button onClick={() => setTipo("retirada")} className={`flex-1 rounded border p-2 text-sm ${tipo === "retirada" ? "border-brand-600 bg-brand-50" : ""}`}>Retirada</button><button onClick={() => setTipo("entrega")} className={`flex-1 rounded border p-2 text-sm ${tipo === "entrega" ? "border-brand-600 bg-brand-50" : ""}`}>Entrega</button></div>
              {tipo === "entrega" && <><input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço de entrega" className="mt-2 w-full rounded border p-2 text-sm" /><input type="number" step=".01" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="Taxa de entrega" className="mt-2 w-full rounded border p-2 text-sm" /></>}
              <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className="mt-2 w-full rounded border p-2 text-sm"><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="pix">PIX</option></select>
              {pagamento === "dinheiro" && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={troco} onChange={(e) => setTroco(e.target.checked)} />Precisa de troco</label>}
              {pagamento === "dinheiro" && troco && <input type="number" step=".01" value={trocoPara} onChange={(e) => setTrocoPara(e.target.value)} placeholder="Troco para R$" className="mt-2 w-full rounded border p-2 text-sm" />}
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações (opcional)" className="mt-2 w-full rounded border p-2 text-sm" />
              <div className="mt-3 flex justify-between font-bold"><span>Total</span><span>R$ {total.toFixed(2)}</span></div>
              <button disabled={salvando || !itens.length} onClick={finalizar} className="mt-3 w-full rounded-lg bg-brand-700 p-3 font-semibold text-white disabled:opacity-40">{salvando ? "Criando pedido..." : "Criar pedido"}</button>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
