"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusLoja from "@/components/StatusLoja";
import { getProdutos } from "@/lib/produtos";
import { useCarrinho } from "@/lib/carrinho-context";
import { Categoria, Produto } from "@/lib/types";
import { lojaAberta } from "@/lib/types";

const categorias: { id: Categoria; label: string }[] = [
  { id: "picole", label: "Picolés" },
  { id: "sorvete", label: "Sorvetes" },
  { id: "acai", label: "Açaí" },
  { id: "monte_do_jeito", label: "Monte do seu jeito" },
];

export default function Home() {
  const [categoriaAtiva, setCategoriaAtiva] = useState<Categoria>("picole");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { itens, adicionarItem, subtotal } = useCarrinho();
  const aberta = lojaAberta();

  useEffect(() => {
    getProdutos()
      .then(setProdutos)
      .finally(() => setCarregando(false));
  }, []);

  const produtosFiltrados = produtos.filter(
    (p) => p.categoria === categoriaAtiva
  );

  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="bg-brand-600 px-4 py-4 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-medium">Frutos de Goiás</h1>
            <p className="text-xs text-white/80">Juiz de Fora · Centro</p>
          </div>
          <StatusLoja />
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3">
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoriaAtiva(c.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              categoriaAtiva === c.id
                ? "bg-brand-600 text-white"
                : "bg-white text-neutral-600 border border-neutral-200"
            }`}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <section className="px-4">
        {carregando && (
          <p className="py-6 text-center text-sm text-neutral-400">
            Carregando cardápio...
          </p>
        )}
        {produtosFiltrados.map((produto) => (
          <div
            key={produto.id}
            className="flex items-center justify-between border-t border-neutral-200 py-3"
          >
            <div>
              <p className="text-sm font-medium">{produto.nome}</p>
              {produto.descricao && (
                <p className="text-xs text-neutral-500">{produto.descricao}</p>
              )}
            </div>

            {produto.categoria === "monte_do_jeito" ? (
              <Link
                href={`/produto/${produto.id}`}
                className="text-brand-600 text-sm font-medium"
              >
                Escolher
              </Link>
            ) : (
              <button
                disabled={!aberta}
                onClick={() =>
                  adicionarItem({
                    produtoId: produto.id,
                    nome: produto.nome,
                    variacaoId: produto.variacoes[0].id,
                    variacaoNome: produto.variacoes[0].nome,
                    adicionais: [],
                    quantidade: 1,
                    precoUnitario: produto.variacoes[0].preco,
                  })
                }
                className="flex items-center gap-2 text-sm font-medium disabled:opacity-40"
              >
                R$ {produto.variacoes[0].preco.toFixed(2)}
                <span className="text-brand-600 text-lg">+</span>
              </button>
            )}
          </div>
        ))}
      </section>

      {!aberta && (
        <p className="mx-4 mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
          Estamos fechados no momento. Confira nosso horário de funcionamento.
        </p>
      )}

      {itens.length > 0 && (
        <Link
          href="/carrinho"
          className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-brand-700 py-3 text-center text-sm font-medium text-white"
        >
          Ver carrinho · {itens.length} {itens.length === 1 ? "item" : "itens"} ·{" "}
          R$ {subtotal.toFixed(2)}
        </Link>
      )}
    </main>
  );
}
