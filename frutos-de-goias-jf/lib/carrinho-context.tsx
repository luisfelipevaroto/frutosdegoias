"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { ItemCarrinho } from "./types";

interface CarrinhoContextType {
  itens: ItemCarrinho[];
  adicionarItem: (item: ItemCarrinho) => void;
  removerItem: (index: number) => void;
  limpar: () => void;
  subtotal: number;
}

const CarrinhoContext = createContext<CarrinhoContextType | null>(null);

export function CarrinhoProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);

  const adicionarItem = (item: ItemCarrinho) =>
    setItens((atual) => [...atual, item]);

  const removerItem = (index: number) =>
    setItens((atual) => atual.filter((_, i) => i !== index));

  const limpar = () => setItens([]);

  const subtotal = useMemo(
    () => itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0),
    [itens]
  );

  return (
    <CarrinhoContext.Provider
      value={{ itens, adicionarItem, removerItem, limpar, subtotal }}
    >
      {children}
    </CarrinhoContext.Provider>
  );
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro de CarrinhoProvider");
  return ctx;
}
