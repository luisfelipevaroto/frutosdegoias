"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import StatusLoja from "./StatusLoja";

interface Props {
  busca: string;
  onBusca: (valor: string) => void;
  quantidadeCarrinho?: number;
}

function CarrinhoIcone({ quantidade }: { quantidade: number }) {
  return (
    <Link
      href="/carrinho"
      aria-label={`Carrinho${quantidade > 0 ? `, ${quantidade} ${quantidade === 1 ? "item" : "itens"}` : ""}`}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-sm transition hover:bg-neutral-50"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
        <circle cx="10" cy="20" r="1.2" />
        <circle cx="18" cy="20" r="1.2" />
      </svg>
      {quantidade > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold text-white">
          {quantidade > 99 ? "99+" : quantidade}
        </span>
      )}
    </Link>
  );
}

export default function LojaHeader({ busca, onBusca, quantidadeCarrinho = 0 }: Props) {
  const [mostrarFixo, setMostrarFixo] = useState(false);

  useEffect(() => {
    const aoRolar = () => setMostrarFixo(window.scrollY > 140);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header className="relative">
      <div className="h-1.5 w-full bg-accent" />
      <div className="relative h-32 w-full bg-brand-700 md:h-48">
        <Image src="/capa.jpg" alt="Frutos de Goiás" fill className="object-cover opacity-90" priority />
      </div>

      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 pb-3 pt-0 md:items-end md:px-6">
        <div className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white p-2 shadow md:h-24 md:w-24">
          <Image src="/logo.svg" alt="Frutos de Goiás" fill className="object-contain" />
        </div>

        <div className="min-w-0 flex-1 pt-2 md:pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-semibold md:text-xl">Frutos de Goiás</h1>
              <p className="truncate text-xs text-neutral-500 md:text-sm">R. Santa Rita, 583 · Centro, Juiz de Fora</p>
            </div>
            <div className="shrink-0 md:hidden">
              <CarrinhoIcone quantidade={quantidadeCarrinho} />
            </div>
            <div className="hidden shrink-0 md:block">
              <StatusLoja />
            </div>
          </div>

          <div className="mt-2 md:hidden">
            <StatusLoja />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-3 md:px-6">
        <label className="relative block">
          <span className="sr-only">Buscar produtos</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      {mostrarFixo && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white/95 shadow-md backdrop-blur md:hidden">
          <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-4">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-white p-1">
              <Image src="/logo.svg" alt="Frutos de Goiás" fill className="object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-neutral-900">Frutos de Goiás</p>
              <div className="mt-0.5">
                <StatusLoja />
              </div>
            </div>
            <CarrinhoIcone quantidade={quantidadeCarrinho} />
          </div>
        </div>
      )}
    </header>
  );
}
