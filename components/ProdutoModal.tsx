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
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white md:rounded-2xl">
        {/* Barra fixa: nome do produto + quantidade + adicionar */}
        <div className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-neutral-100 bg-white px-3 py-3 shadow-sm">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
            {produto.nome}
          </h2>

          <div className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-1 py-1">
            <button
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-neutral-700 hover:bg-white"
              aria-label="Diminuir quantidade"
            >
              −
            </button>
            <span className="min-w-5 text-center text-sm font-semibold">{quantidade}</span>
            <button
              onClick={() => setQuantidade((q) => q + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-lg text-neutral-700 hover:bg-white"
              aria-label="Aumentar quantidade"
            >
              +
            </button>
          </div>

          <button
            onClick={confirmar}
            disabled={!aberta}
            className="shrink-0 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {aberta ? `Adicionar · R$ ${totalItem.toFixed(2)}` : "Fechada"}
          </button>

          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-neutral-400 hover:bg-neutral-100"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Conteúdo com rolagem */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Imagem do produto em formato quadrado, sem cortar a foto */}
          <div className="relative aspect-square w-full bg-neutral-100">
            {produto.foto ? (
              <Image
                src={produto.foto}
                alt={produto.nome}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 448px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-5xl">🍨</div>
            )}
          </div>

          <div className="p-4">
            {/* Preço logo abaixo da foto e antes da descrição */}
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
              <span className="text-2xl font-bold text-neutral-900">R$ {precoFinal.toFixed(2)}</span>
            </div>

            {produto.descricao && (
              <p className="mb-4 text-sm leading-relaxed text-neutral-500">{produto.descricao}</p>
            )}

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

            {/* Espaço inferior para o conteúdo não ficar escondido pela barra fixa */}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
