"use client";

import Image from "next/image";
import { Produto } from "@/lib/types";

interface Props {
  produto: Produto;
  aberta: boolean;
  onAbrirDetalhes: () => void;
  onAdicionarRapido: () => void;
}

export default function ProdutoCard({
  produto,
  aberta,
  onAbrirDetalhes,
  onAdicionarRapido,
}: Props) {
  const temVariacao = produto.variacoes.length > 0;
  const precoBase = temVariacao ? produto.variacoes[0].preco : produto.preco ?? 0;
  const emOferta =
    !temVariacao && produto.precoPromocional != null && produto.precoPromocional < precoBase;
  const precoExibido = emOferta ? produto.precoPromocional! : precoBase;

  return (
    <button
      onClick={onAbrirDetalhes}
      className="flex items-center gap-3 border-t border-neutral-200 py-3 text-left md:flex-col md:items-stretch md:gap-0 md:rounded-card md:border md:border-neutral-200 md:bg-white md:p-0 md:shadow-sm"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-100 md:h-36 md:w-full md:rounded-t-card md:rounded-b-none">
        {produto.foto ? (
          <Image
            src={produto.foto}
            alt={produto.nome}
            fill
            sizes="(max-width: 768px) 56px, 300px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🍨</div>
        )}
        {emOferta && (
          <span className="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Oferta
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-between md:flex-col md:items-stretch md:gap-2 md:p-3">
        <div>
          <p className="text-sm font-medium">{produto.nome}</p>
          {produto.descricao && (
            <p className="text-xs text-neutral-500 md:line-clamp-2">{produto.descricao}</p>
          )}
        </div>

        {temVariacao ? (
          <span className="text-brand-600 shrink-0 text-sm font-medium md:mt-1 md:text-left">
            Escolher →
          </span>
        ) : (
          <div
            onClick={(e) => {
              // impede que o clique no botão "+" também dispare a abertura do pop-up
              e.stopPropagation();
              onAdicionarRapido();
            }}
            className="flex shrink-0 items-center gap-2 text-sm font-medium md:mt-1 md:justify-between md:rounded-lg md:bg-brand-50 md:px-3 md:py-2 md:text-brand-700"
          >
            <span className="flex items-center gap-1.5">
              {emOferta && (
                <span className="text-xs text-neutral-400 line-through">
                  R$ {precoBase.toFixed(2)}
                </span>
              )}
              R$ {precoExibido.toFixed(2)}
            </span>
            <button disabled={!aberta} className="text-brand-600 text-lg disabled:opacity-40">
              +
            </button>
          </div>
        )}
      </div>
    </button>
  );
}
