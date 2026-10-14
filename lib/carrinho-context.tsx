"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ItemCarrinho } from "./types";
import { getEmpresaAtual } from "./empresa";

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
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const altered = useRef(false);
  useEffect(() => {
    let disposed = false;
    getEmpresaAtual().then(empresa => {
      if (disposed || !empresa) return;
      const key = `delivery_carrinho_v1:${empresa.id}`;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (!altered.current && saved?.version === 1 && Date.now() - saved.savedAt < 7 * 86400000 && Array.isArray(saved.itens)) {
          setItens(saved.itens.filter((i: ItemCarrinho) => typeof i?.produtoId === 'string' && typeof i.nome === 'string' && Number.isInteger(i.quantidade) && i.quantidade > 0 && i.quantidade <= 100 && Number.isFinite(i.precoUnitario) && i.precoUnitario >= 0 && Array.isArray(i.adicionais)).slice(0,100));
        }
      } catch { /* Storage may be unavailable or contain an obsolete cart. */ }
      setStorageKey(key);
    }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (!itens.length) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify({version:1,savedAt:Date.now(),itens}));
    } catch { /* A full/blocked store must not prevent a purchase. */ }
  }, [itens, storageKey]);

  const adicionarItem = (item: ItemCarrinho) => {
    altered.current = true;
    setItens((atual) => [...atual, item]);
  };

  const removerItem = (index: number) => {
    altered.current = true;
    setItens((atual) => atual.filter((_, i) => i !== index));
  };

  const limpar = () => { altered.current = true; setItens([]); };

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
