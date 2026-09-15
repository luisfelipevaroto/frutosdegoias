"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho-context";
import { lojaAberta } from "@/lib/types";

export default function CarrinhoLateral() {
  const { itens, removerItem, subtotal } = useCarrinho();
  const aberta = lojaAberta();

  return (
    <aside className="sticky top-6 hidden h-fit w-80 shrink-0 rounded-card border border-neutral-200 bg-white p-4 shadow-sm lg:block">
      <h2 className="mb-3 text-sm font-semibold">Seu carrinho</h2>

      {itens.length === 0 ? (
        <p className="text-sm text-neutral-400">
          Adicione itens do cardápio para começar.
        </p>
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto">
            {itens.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-neutral-100 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{item.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {item.variacaoNome}
                    {item.adicionais.length > 0 &&
                      ` · ${item.adicionais.map((a) => a.nome).join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span>R$ {(item.precoUnitario * item.quantidade).toFixed(2)}</span>
                  <button
                    onClick={() => removerItem(i)}
                    className="text-xs text-red-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between text-sm font-medium">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>

          {aberta ? (
            <Link
              href="/checkout"
              className="mt-3 block rounded-lg bg-brand-700 py-2.5 text-center text-sm font-medium text-white"
            >
              Ir para o checkout
            </Link>
          ) : (
            <p className="mt-3 rounded-lg bg-red-50 p-2 text-center text-xs text-red-700">
              Loja fechada — finalize quando reabrir.
            </p>
          )}
        </>
      )}
    </aside>
  );
}
