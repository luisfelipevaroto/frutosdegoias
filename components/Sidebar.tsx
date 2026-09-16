"use client";

import { Categoria, Produto, rotuloSubcategoria } from "@/lib/types";

interface Props {
  produtos: Produto[];
  categoriaAtiva: Categoria;
  subcategoriaAtiva: string | null;
  onSelecionarCategoria: (c: Categoria) => void;
  onSelecionarSubcategoria: (s: string | null) => void;
}

export const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: "picole", label: "Picolés" },
  { id: "sorvete", label: "Sorvetes" },
  { id: "paleta", label: "Paletas" },
  { id: "acai", label: "Açaí" },
  { id: "monte_do_jeito", label: "Monte do seu jeito" },
];

// Descobre as subcategorias existentes de uma categoria, direto dos produtos.
// Assim, criar uma subcategoria nova no banco não exige mexer no código.
export function subcategoriasDe(produtos: Produto[], categoria: Categoria): string[] {
  return Array.from(
    new Set(
      produtos
        .filter((p) => p.categoria === categoria && p.subcategoria)
        .map((p) => p.subcategoria as string)
    )
  ).sort();
}

export default function Sidebar({
  produtos,
  categoriaAtiva,
  subcategoriaAtiva,
  onSelecionarCategoria,
  onSelecionarSubcategoria,
}: Props) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block">
      <nav className="sticky top-4 space-y-1">
        {CATEGORIAS.map((c) => {
          const total = produtos.filter((p) => p.categoria === c.id).length;
          if (total === 0) return null;

          const ativa = categoriaAtiva === c.id;
          const subs = subcategoriasDe(produtos, c.id);

          return (
            <div key={c.id}>
              <button
                onClick={() => {
                  onSelecionarCategoria(c.id);
                  onSelecionarSubcategoria(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  ativa ? "bg-brand-50 font-medium text-brand-700" : "text-neutral-600"
                }`}
              >
                {c.label}
                <span className="text-xs text-neutral-400">{total}</span>
              </button>

              {ativa && subs.length > 0 && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-3">
                  <button
                    onClick={() => onSelecionarSubcategoria(null)}
                    className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                      subcategoriaAtiva === null
                        ? "font-medium text-brand-700"
                        : "text-neutral-500"
                    }`}
                  >
                    Todos
                  </button>
                  {subs.map((s) => {
                    const totalSub = produtos.filter(
                      (p) => p.categoria === c.id && p.subcategoria === s
                    ).length;
                    return (
                      <button
                        key={s}
                        onClick={() => onSelecionarSubcategoria(s)}
                        className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          subcategoriaAtiva === s
                            ? "font-medium text-brand-700"
                            : "text-neutral-500"
                        }`}
                      >
                        {rotuloSubcategoria(s)}{" "}
                        <span className="text-neutral-400">{totalSub}</span>
                      </button>
                    );
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
