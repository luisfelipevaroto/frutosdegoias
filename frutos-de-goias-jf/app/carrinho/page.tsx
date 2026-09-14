"use client";

import Link from "next/link";
import { useCarrinho } from "@/lib/carrinho-context";
import { lojaAberta } from "@/lib/types";

export default function Carrinho() {
  const { itens, removerItem, subtotal } = useCarrinho();
  const aberta = lojaAberta();

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-base font-medium">Seu carrinho</h1>

      {itens.length === 0 && (
        <p className="text-sm text-neutral-500">Seu carrinho está vazio.</p>
      )}

      {itens.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-neutral-200 py-3"
        >
          <div>
            <p className="text-sm font-medium">{item.nome}</p>
            <p className="text-xs text-neutral-500">
              {item.variacaoNome}
              {item.adicionais.length > 0 &&
                ` · ${item.adicionais.map((a) => a.nome).join(", ")}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              R$ {(item.precoUnitario * item.quantidade).toFixed(2)}
            </span>
            <button
              onClick={() => removerItem(i)}
              className="text-xs text-red-600"
            >
              Remover
            </button>
          </div>
        </div>
      ))}

      {itens.length > 0 && (
        <>
          <div className="mt-4 flex justify-between text-sm font-medium">
            <span>Subtotal</span>
            <span>R$ {subtotal.toFixed(2)}</span>
          </div>

          {!aberta ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-700">
              A loja está fechada agora, então não é possível finalizar o
              pedido. Volte durante o horário de funcionamento.
            </p>
          ) : (
            <Link
              href="/checkout"
              className="mt-4 block rounded-lg bg-brand-700 py-3 text-center text-sm font-medium text-white"
            >
              Ir para o checkout
            </Link>
          )}
        </>
      )}
    </main>
  );
}
