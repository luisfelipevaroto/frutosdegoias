"use client";

import Image from "next/image";
import { Produto } from "@/lib/types";

interface Props {
  produto: Produto;
  aberta: boolean;
  onAbrirDetalhes: () => void;
  onAdicionarRapido: () => void;
}

export default function ProdutoCard({ produto, aberta, onAbrirDetalhes, onAdicionarRapido }: Props) {
  const temVariacao = produto.variacoes.length > 0;
  const precoBase = temVariacao ? produto.variacoes[0].preco : produto.preco ?? 0;
  const emOferta = !temVariacao && produto.precoPromocional != null && produto.precoPromocional < precoBase;
  const precoExibido = emOferta ? produto.precoPromocional! : precoBase;

  return (
    <div className="flex items-center gap-3 border-t border-neutral-200 py-3 text-left md:flex-col md:items-stretch md:gap-0 md:rounded-card md:border md:border-neutral-200 md:bg-white md:p-0 md:shadow-sm">
      <button onClick={onAbrirDetalhes} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100 md:h-36 md:w-full md:rounded-t-card md:rounded-b-none" aria-label={`Ver detalhes de ${produto.nome}`}>
        {produto.foto ? <Image src={produto.foto} alt={produto.nome} fill sizes="(max-width: 768px) 64px, 300px" className="object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">🍨</div>}
        {emOferta && <span className="absolute left-1.5 top-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Oferta</span>}
      </button>

      <div className="min-w-0 flex-1 md:p-3">
        <button onClick={onAbrirDetalhes} className="block w-full text-left">
          <p className="text-sm font-medium">{produto.nome}</p>
          {produto.descricao && <p className="mt-0.5 text-xs text-neutral-500 md:line-clamp-2">{produto.descricao}</p>}
        </button>

        <div className="mt-1 flex items-center justify-between gap-2 md:mt-2">
          {temVariacao ? (
            <button onClick={onAbrirDetalhes} className="text-sm font-medium text-brand-600">Escolher →</button>
          ) : (
            <div className="min-w-0">
              {emOferta && <span className="block text-xs text-neutral-400 line-through">R$ {precoBase.toFixed(2)}</span>}
              <span className="text-sm font-semibold text-neutral-900">R$ {precoExibido.toFixed(2)}</span>
            </div>
          )}

          {!temVariacao && (
            <button
              type="button"
              disabled={!aberta}
              onClick={onAdicionarRapido}
              aria-label={`Adicionar ${produto.nome} ao carrinho`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xl leading-none text-white shadow-sm disabled:opacity-40"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
