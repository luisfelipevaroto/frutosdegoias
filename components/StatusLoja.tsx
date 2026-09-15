"use client";

import { useEffect, useState } from "react";
import { lojaAberta, HORARIO_FUNCIONAMENTO } from "@/lib/types";

export default function StatusLoja() {
  // Recalcula a cada minuto para não depender de refresh manual
  const [aberta, setAberta] = useState<boolean | null>(null);

  useEffect(() => {
    const checar = () => setAberta(lojaAberta());
    checar();
    const intervalo = setInterval(checar, 60_000);
    return () => clearInterval(intervalo);
  }, []);

  if (aberta === null) return null; // evita mismatch de hidratação SSR

  return (
    <span
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        aberta
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {aberta
        ? `Aberto até ${
            [0, 6].includes(new Date().getDay())
              ? HORARIO_FUNCIONAMENTO.sabDom.fecha
              : HORARIO_FUNCIONAMENTO.segSex.fecha
          }h`
        : "Fechado no momento"}
    </span>
  );
}
