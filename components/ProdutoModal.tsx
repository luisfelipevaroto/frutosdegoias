"use client";

import { useState } from "react";
import Image from "next/image";
import { Adicional, Produto } from "@/lib/types";

interface Props {
  produto: Produto;
  aberta: boolean;
  onClose: () => void;
  onAdicionar: (payload: {
    variacaoId: string;
    variacaoNome: string;
    adicionais: Adicional[];
    quantidade: number;
    precoUnitario: number;
  }) => void;
}

export default function ProdutoModal({ produto, aberta, onClose, onAdicionar }: Props) {
  const temVariacao = produto.variacoes.length > 0;
  const [variacaoId, setVariacaoId] = useState(
    temVariacao ? produto.variacoes[0].id : "unico"
  );
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<Adicional[]>([]);
  const [quantidade, setQuantidade] = useState(1);

  const variacaoAtual = produto.variacoes.find((v) => v.id === variacaoId);
  const precoBase = temVariacao ? variacaoAtual?.preco ?? 0 : produto.preco ?? 0;

  const emOferta =
    !temVariacao &&
    produto.precoPromocional != null &&
    produto.precoPromocional < precoBase;
  const precoFinal = emOferta ? produto.precoPromocional! : precoBase;

  const totalAdicionais = adicionaisSelecionados.reduce((s, a) => s + a.preco, 0);
  const totalItem = (precoFinal + totalAdicionais) * quantidade;

  function alternarAdicional(a: Adicional) {
    setAdicionaisSelecionados((atual) =>
      atual.some((x) => x.id === a.id)
        ? atual.filter((x) => x.id !== a.id)
        : [...atual, a]
    );
  }

  function confirmar() {
    onAdicionar({
      variacaoId,
      variacaoNome: temVariacao ? variacaoAtual?.nome ?? "" : "Unidade",
      adicionais: adicionaisSelecionados,
      quantidade,
      precoUnitario: precoFinal + totalAdicionais,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 md:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold">{produto.nome}</h2>
          <button onClick={onClose} className="text-xl text-neutral-400" aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="relative h-56 w-full bg-neutral-100">
          {produto.foto ? (
            <Image src={produto.foto} alt={produto.nome} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">🍨</div>
          )}
        </div>

        <div className="p-4">
          {produto.descricao && (
            <p className="mb-3 text-sm text-neutral-500">{produto.descricao}</p>
          )}

          {/* Preço, com destaque de oferta quando houver preço promocional */}
          <div className="mb-4 flex items-center gap-2">
            {emOferta && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                Oferta
              </span>
            )}
            {emOferta && (
              <span className="text-sm text-neutral-400 line-through">
                R$ {precoBase.toFixed(2)}
              </span>
            )}
            <span className="text-lg font-semibold">R$ {precoFinal.toFixed(2)}</span>
          </div>

          {temVariacao && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-neutral-500">Tamanho</p>
              <div className="flex gap-2">
                {produto.variacoes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVariacaoId(v.id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      variacaoId === v.id
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-neutral-200 text-neutral-500"
                    }`}
                  >
                    {v.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {produto.adicionaisDisponiveis && produto.adicionaisDisponiveis.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-neutral-500">Adicionais</p>
              {produto.adicionaisDisponiveis.map((a) => {
                const marcado = adicionaisSelecionados.some((x) => x.id === a.id);
                return (
                  <label
                    key={a.id}
                    className="flex items-center justify-between border-t border-neutral-100 py-2 text-sm"
                  >
                    <span>{a.nome}</span>
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternarAdicional(a)}
                    />
                  </label>
                );
              })}
            </div>
          )}

          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="h-8 w-8 rounded-full border border-neutral-200 text-lg"
            >
              −
            </button>
            <span className="text-sm font-medium">{quantidade}</span>
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="h-8 w-8 rounded-full border border-neutral-200 text-lg"
            >
              +
            </button>
          </div>

          <button
            onClick={confirmar}
            disabled={!aberta}
            className="w-full rounded-lg bg-brand-700 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {aberta ? `Adicionar · R$ ${totalItem.toFixed(2)}` : "Loja fechada"}
          </button>
        </div>
      </div>
    </div>
  );
}
