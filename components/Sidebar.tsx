"use client";

import { Categoria, Produto, SUBCATEGORIAS_PICOLE } from "@/lib/types";

interface Props {
  produtos: Produto[];
  categoriaAtiva: Categoria;
  subcategoriaAtiva: string | null;
  onSelecionarCategoria: (c: Categoria) => void;
  onSelecionarSubcategoria: (s: string | null) => void;
}

const categorias: { id: Categoria; label: string }[] = [
  { id: "picole", label: "Picolés" },
  { id: "sorvete", label: "Sorvetes" },
  { id: "acai", label: "Açaí" },
  { id: "monte_do_jeito", label: "Monte do seu jeito" },
];

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
        {categorias.map((c) => {
          const total = produtos.filter((p) => p.categoria === c.id).length;
          const ativa = categoriaAtiva === c.id;

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

              {/* Subcategorias — hoje só picolé usa, mas o padrão serve pra qualquer categoria */}
              {c.id === "picole" && ativa && (
                <div className="ml-3 mt-1 space-y-0.5 border-l border-neutral-200 pl-3">
                  {SUBCATEGORIAS_PICOLE.map((s) => {
                    const totalSub = produtos.filter(
                      (p) => p.categoria === "picole" && p.subcategoria === s.id
                    ).length;
                    if (totalSub === 0) return null;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onSelecionarSubcategoria(s.id)}
                        className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                          subcategoriaAtiva === s.id
                            ? "font-medium text-brand-700"
                            : "text-neutral-500"
                        }`}
                      >
                        {s.label} <span className="text-neutral-400">{totalSub}</span>
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
