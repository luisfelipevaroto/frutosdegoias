"use client";

import { useState } from "react";
import { useCarrinho } from "@/lib/carrinho-context";
import { FormaPagamento, TipoEntrega } from "@/lib/types";

// TODO: substituir pelo cálculo real (raio por km ou cotação Uber Direct)
function calcularTaxaEntrega(endereco: string): number {
  return endereco ? 6 : 0;
}

export default function Checkout() {
  const { itens, subtotal } = useCarrinho();
  const [tipo, setTipo] = useState<TipoEntrega>("entrega");
  const [endereco, setEndereco] = useState("");
  const [horarioRetirada, setHorarioRetirada] = useState("");
  const [pagamento, setPagamento] = useState<FormaPagamento>("pix");

  const taxaEntrega = tipo === "entrega" ? calcularTaxaEntrega(endereco) : 0;
  const total = subtotal + taxaEntrega;

  // Retirada libera dinheiro na hora; entrega só Pix/cartão via Mercado Pago
  const formasDisponiveis: FormaPagamento[] =
    tipo === "entrega" ? ["pix", "cartao"] : ["dinheiro", "pix", "cartao"];

  async function confirmarPedido() {
    // TODO: chamar POST /api/pedidos com { itens, tipo, endereco ou horarioRetirada,
    // taxaEntrega, pagamento, total, clienteId } e, se pix/cartão, criar a
    // preferência de pagamento no Mercado Pago e redirecionar/checar status.
    alert("Aqui entra a chamada real para /api/pedidos + Mercado Pago");
  }

  return (
    <main className="mx-auto max-w-md p-4 pb-24">
      <h1 className="mb-4 text-base font-medium">Como você quer receber?</h1>

      <div className="mb-4 flex gap-2">
        {(["entrega", "retirada"] as TipoEntrega[]).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`flex-1 rounded-lg border py-3 text-sm font-medium capitalize ${
              tipo === t
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-neutral-200 text-neutral-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tipo === "entrega" ? (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">
            Endereço de entrega (Centro de Juiz de Fora)
          </label>
          <input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro"
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-500">
            Horário de retirada (seg-sex 11h-19h, sáb-dom 11h-17h)
          </label>
          <input
            type="time"
            value={horarioRetirada}
            onChange={(e) => setHorarioRetirada(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </div>
      )}

      <label className="mb-1 block text-xs text-neutral-500">
        Forma de pagamento
      </label>
      <div className="mb-4 flex gap-2">
        {formasDisponiveis.map((f) => (
          <button
            key={f}
            onClick={() => setPagamento(f)}
            className={`flex-1 rounded-lg border py-2 text-sm capitalize ${
              pagamento === f
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-neutral-200 text-neutral-500"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="border-t border-neutral-200 pt-3 text-sm">
        <div className="flex justify-between text-neutral-500">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2)}</span>
        </div>
        {tipo === "entrega" && (
          <div className="flex justify-between text-neutral-500">
            <span>Taxa de entrega</span>
            <span>R$ {taxaEntrega.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between font-medium">
          <span>Total</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={confirmarPedido}
        disabled={itens.length === 0}
        className="mt-4 w-full rounded-lg bg-brand-700 py-3 text-sm font-medium text-white disabled:opacity-40"
      >
        Confirmar pedido
      </button>
    </main>
  );
}
