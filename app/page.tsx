"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LojaHeader from "@/components/LojaHeader";
import CarrinhoLateral from "@/components/CarrinhoLateral";
import ProdutoCard from "@/components/ProdutoCard";
import ProdutoModal from "@/components/ProdutoModal";
import Sidebar from "@/components/Sidebar";
import { getProdutos } from "@/lib/produtos";
import { useCarrinho } from "@/lib/carrinho-context";
import { Categoria, Produto, lojaAberta } from "@/lib/types";

const categorias: { id: Categoria; label: string }[] = [
  { id: "picole", label: "Picolés" },
  { id: "sorvete", label: "Sorvetes" },
  { id: "acai", label: "Açaí" },
  { id: "monte_do_jeito", label: "Monte do seu jeito" },
];

export default function Home() {
  const [categoriaAtiva, setCategoriaAtiva] = useState<Categoria>("picole");
  const [subcategoriaAtiva, setSubcategoriaAtiva] = useState<string | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoAberto, setProdutoAberto] = useState<Produto | null>(null);
  const { itens, adicionarItem, subtotal } = useCarrinho();
  const aberta = lojaAberta();

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .finally(() => setCarregando(false));
  }, []);

  const produtosFiltrados = produtos.filter(
    (p) =>
      p.categoria === categoriaAtiva &&
      (subcategoriaAtiva === null || p.subcategoria === subcategoriaAtiva)
  );

  return (
    <main className="pb-24 lg:pb-8">
      <LojaHeader />

      <div className="mx-auto flex max-w-6xl gap-6 px-4 md:px-6">
        <Sidebar
          produtos={produtos}
          categoriaAtiva={categoriaAtiva}
          subcategoriaAtiva={subcategoriaAtiva}
          onSelecionarCategoria={setCategoriaAtiva}
          onSelecionarSubcategoria={setSubcategoriaAtiva}
        />

        <div className="flex-1">
          {/* Categorias — visível só no celular/tablet; no desktop isso é o Sidebar */}
          <nav className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-neutral-50 px-4 py-3 lg:hidden">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCategoriaAtiva(c.id);
                  setSubcategoriaAtiva(null);
                }}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                  categoriaAtiva === c.id
                    ? "bg-brand-600 text-white"
                    : "border border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </nav>

          {/* Chips de subcategoria — visível no celular quando a categoria ativa tem subcategorias */}
          {categoriaAtiva === "picole" && (
            <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 lg:hidden">
              <button
                onClick={() => setSubcategoriaAtiva(null)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                  subcategoriaAtiva === null
                    ? "bg-brand-50 font-medium text-brand-700"
                    : "text-neutral-500"
                }`}
              >
                Todos
              </button>
              {Array.from(
                new Set(
                  produtos
                    .filter((p) => p.categoria === "picole" && p.subcategoria)
                    .map((p) => p.subcategoria as string)
                )
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => setSubcategoriaAtiva(s)}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${
                    subcategoriaAtiva === s
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-neutral-500"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
          )}

          {carregando && (
            <p className="py-6 text-center text-sm text-neutral-400">
              Carregando cardápio...
            </p>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {produtosFiltrados.map((produto) => (
              <ProdutoCard
                key={produto.id}
                produto={produto}
                aberta={aberta}
                onAbrirDetalhes={() => setProdutoAberto(produto)}
                onAdicionarRapido={() =>
                  adicionarItem({
                    produtoId: produto.id,
                    nome: produto.nome,
                    variacaoId: "unico",
                    variacaoNome: "Unidade",
                    adicionais: [],
                    quantidade: 1,
                    precoUnitario:
                      produto.precoPromocional != null &&
                      produto.precoPromocional < (produto.preco ?? 0)
                        ? produto.precoPromocional
                        : produto.preco ?? 0,
                  })
                }
              />
            ))}
          </section>

          {!aberta && (
            <p className="mx-4 mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700 md:mx-0">
              Estamos fechados no momento. Confira nosso horário de funcionamento.
            </p>
          )}
        </div>

        <CarrinhoLateral />
      </div>

      {produtoAberto && (
        <ProdutoModal
          produto={produtoAberto}
          aberta={aberta}
          onClose={() => setProdutoAberto(null)}
          onAdicionar={(payload) =>
            adicionarItem({
              produtoId: produtoAberto.id,
              nome: produtoAberto.nome,
              ...payload,
            })
          }
        />
      )}

      {/* Barra flutuante só no mobile — no desktop o carrinho já fica visível na lateral */}
      {itens.length > 0 && (
        <Link
          href="/carrinho"
          className="fixed bottom-0 left-0 right-0 bg-brand-700 py-3 text-center text-sm font-medium text-white lg:hidden"
        >
          Ver carrinho · {itens.length} {itens.length === 1 ? "item" : "itens"} · R${" "}
          {subtotal.toFixed(2)}
        </Link>
      )}
    </main>
  );
}
