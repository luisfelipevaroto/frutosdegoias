"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LojaHeader from "@/components/LojaHeader";
import CarrinhoLateral from "@/components/CarrinhoLateral";
import ProdutoCard from "@/components/ProdutoCard";
import ProdutoModal from "@/components/ProdutoModal";
import Sidebar, { CATEGORIAS, CategoriaCatalogo, subcategoriasDe } from "@/components/Sidebar";
import { getProdutos } from "@/lib/produtos";
import { useCarrinho } from "@/lib/carrinho-context";
import { Produto, lojaAberta, rotuloSubcategoria } from "@/lib/types";

function ePromocao(p: Produto) {
  return p.precoPromocional != null && p.preco != null && p.precoPromocional < p.preco;
}

export default function Home() {
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaCatalogo>("picole");
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<"aleatoria" | "cadastro" | "alfabetica">("cadastro");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const { itens, adicionarItem, subtotal } = useCarrinho();
  const aberta = lojaAberta();

  useEffect(() => {
    getProdutos().then(setProdutos).finally(() => setCarregando(false));
  }, []);

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const emBusca = termo.length > 0;

  const produtosFiltrados = useMemo(() => {
    const filtrados = produtos.filter((p) => {
      if (emBusca) return p.nome.toLocaleLowerCase("pt-BR").includes(termo);
      if (categoriaAtiva === "promocoes") return ePromocao(p);
      return p.categoria === categoriaAtiva && (subcategoriaAtiva === null || p.subcategoria === subcategoriaAtiva);
    });

    if (ordenacao === "alfabetica") {
      return [...filtrados].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }

    if (ordenacao === "aleatoria") {
      return [...filtrados].sort(() => Math.random() - 0.5);
    }

    return [...filtrados].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [produtos, categoriaAtiva, subcategoriaAtiva, termo, emBusca, ordenacao]);

  const subsDaCategoria = subcategoriasDe(produtos, categoriaAtiva);
  const categoriasComProduto = CATEGORIAS.filter((c) => {
    if (c.id === "promocoes") return produtos.some(ePromocao);
    return produtos.some((p) => p.categoria === c.id);
  });

  function selecionarCategoria(c: CategoriaCatalogo) {
    setCategoriaAtiva(c);
    setSubcategoriaAtiva(null);
    setBusca("");
  }

  function precoDe(p: Produto) {
    const base = p.preco ?? 0;
    return ePromocao(p) ? p.precoPromocional! : base;
  }

  return (
    <main className="pb-24 lg:pb-8">
      <LojaHeader busca={busca} onBusca={setBusca} quantidadeCarrinho={itens.length} />

      <div className="mx-auto flex max-w-6xl gap-6 px-4 md:px-6">
        <Sidebar produtos={produtos} categoriaAtiva={categoriaAtiva} subcategoriaAtiva={subcategoriaAtiva} onSelecionarCategoria={selecionarCategoria} onSelecionarSubcategoria={setSubcategoriaAtiva} />

        <div className="min-w-0 flex-1">
          <nav className="sticky top-0 z-10 -mx-4 flex min-w-0 gap-2 overflow-x-auto bg-neutral-50 px-4 py-3 lg:hidden">
            {categoriasComProduto.map((c) => (
              <button key={c.id} onClick={() => selecionarCategoria(c.id)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${categoriaAtiva === c.id && !emBusca ? "bg-brand-600 text-white" : "border border-neutral-200 bg-white text-neutral-600"}`}>
                {c.label}
              </button>
            ))}
          </nav>

          {subsDaCategoria.length > 0 && !emBusca && (
            <div className="-mx-4 mb-2 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
              <button onClick={() => setSubcategoriaAtiva(null)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${subcategoriaAtiva === null ? "bg-brand-50 font-medium text-brand-700" : "text-neutral-500"}`}>Todos</button>
              {subsDaCategoria.map((s) => (
                <button key={s} onClick={() => setSubcategoriaAtiva(s)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${subcategoriaAtiva === s ? "bg-brand-50 font-medium text-brand-700" : "text-neutral-500"}`}>
                  {rotuloSubcategoria(s)}
                </button>
              ))}
            </div>
          )}

          <div className="mb-3 flex justify-end">
            <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none focus:border-brand-500">
              <option value="cadastro">Ordem de cadastro</option>
              <option value="aleatoria">Ordem aleatória</option>
              <option value="alfabetica">Ordem alfabética</option>
            </select>
          </div>

          {emBusca && <p className="mb-3 text-sm text-neutral-500">Resultados para <strong className="text-neutral-800">“{busca}”</strong></p>}

          {carregando && <p className="py-6 text-center text-sm text-neutral-400">Carregando cardápio...</p>}

          {!carregando && produtosFiltrados.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-sm text-neutral-500">Nenhum produto encontrado.</p>}

          <section className="grid grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {produtosFiltrados.map((produto) => (
              <ProdutoCard key={produto.id} produto={produto} aberta={aberta} onAbrirDetalhes={() => setProdutoAberto(produto)} onAdicionarRapido={() => adicionarItem({ produtoId: produto.id, nome: produto.nome, variacaoId: "unico", variacaoNome: "Unidade", adicionais: [], quantidade: 1, precoUnitario: precoDe(produto) })} />
            ))}
          </section>

          {!aberta && <p className="mx-4 mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700 md:mx-0">Estamos fechados no momento. Confira nosso horário de funcionamento.</p>}
        </div>
        <CarrinhoLateral />
      </div>

      {produtoAberto && <ProdutoModal produto={produtoAberto} aberta={aberta} onClose={() => setProdutoAberto(null)} onAdicionar={(payload) => adicionarItem({ produtoId: produtoAberto.id, nome: produtoAberto.nome, ...payload })} />}

      {itens.length > 0 && <Link href="/carrinho" className="fixed bottom-0 left-0 right-0 bg-brand-700 py-3 text-center text-sm font-medium text-white lg:hidden">Ver carrinho · {itens.length} {itens.length === 1 ? "item" : "itens"} · R$ {subtotal.toFixed(2)}</Link>}
    </main>
  );
}