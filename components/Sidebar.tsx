"use client";

import { Produto, rotuloCategoria, rotuloSubcategoria } from "@/lib/types";

export type CategoriaCatalogo = string;

interface Props {
  produtos: Produto[];
  categoriaAtiva: CategoriaCatalogo;
  subcategoriaAtiva: string | null;
  onSelecionarCategoria: (c: CategoriaCatalogo) => void;
  onSelecionarSubcategoria: (s: string | null) => void;
}

export function categoriasDe(produtos: Produto[]) {
  const ids = Array.from(new Set(produtos.map((p) => p.categoria).filter(Boolean)));
  const categorias = ids.map((id) => ({ id, label: rotuloCategoria(id) }));
  const temPromocao = produtos.some(ePromocao);
  if (temPromocao) categorias.push({ id: "promocoes", label: "Promoções" });
  return categorias;
}

export function subcategoriasDe(produtos: Produto[], categoria: CategoriaCatalogo): string[] {
  if (categoria === "promocoes") return [];
  return Array.from(new Set(produtos.filter((p) => p.categoria === categoria && p.subcategoria).map((p) => p.subcategoria as string))).sort();
}

function ePromocao(p: Produto) {
  return p.precoPromocional != null && p.preco != null && p.precoPromocional < p.preco;
}

export default function Sidebar({ produtos, categoriaAtiva, subcategoriaAtiva, onSelecionarCategoria, onSelecionarSubcategoria }: Props) {
  const categorias = categoriasDe(produtos);
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-4 space-y-1">
        {categorias.map((c) => {
          const total = c.id === "promocoes" ? produtos.filter(ePromocao).length : produtos.filter((p) => p.categoria === c.id).length;
          const ativa = categoriaAtiva === c.id;
          const subs = subcategoriasDe(produtos, c.id);
          return (
            <div key={c.id}>
              <button onClick={() => { onSelecionarCategoria(c.id); onSelecionarSubcategoria(null); }} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${ativa ? "bg-brand-50 font-medium text-brand-700" : "text-neutral-600"}`}>
                {c.label}<span className="text-xs text-neutral-400">{total}</span>
              </button>
              {ativa && subs.length > 0 && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-3">
                  <button onClick={() => onSelecionarSubcategoria(null)} className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${subcategoriaAtiva === null ? "font-medium text-brand-700" : "text-neutral-500"}`}>Todos</button>
                  {subs.map((s) => {
                    const totalSub = produtos.filter((p) => p.categoria === c.id && p.subcategoria === s).length;
                    return <button key={s} onClick={() => onSelecionarSubcategoria(s)} className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${subcategoriaAtiva === s ? "font-medium text-brand-700" : "text-neutral-500"}`}>{rotuloSubcategoria(s)} <span className="text-neutral-400">{totalSub}</span></button>;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
