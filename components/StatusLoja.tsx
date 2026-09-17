"use client";

import { useEffect, useState } from "react";
import { getEmpresaAtual } from "@/lib/empresa";
import { HorariosLoja, lojaAberta } from "@/lib/types";

const NOMES_DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

export default function StatusLoja() {
  const [aberta, setAberta] = useState<boolean | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let intervalo: ReturnType<typeof setInterval> | null = null;

    getEmpresaAtual().then((empresa) => {
      if (!ativo) return;
      const configuracoes = empresa?.configuracoes;
      const horarios = configuracoes && typeof configuracoes === "object"
        ? (configuracoes.horarios as HorariosLoja | undefined)
        : undefined;

      const checar = () => {
        const agora = new Date();
        setAberta(lojaAberta(horarios, agora));
        const regra = horarios?.[NOMES_DIAS[agora.getDay()]];
        setFecha(regra?.fecha ?? null);
      };

      checar();
      intervalo = setInterval(checar, 60_000);
    });

    return () => {
      ativo = false;
      if (intervalo) clearInterval(intervalo);
    };
  }, []);

  if (aberta === null) return null;

  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${aberta ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {aberta ? (fecha ? `Aberto até ${fecha}` : "Aberto agora") : "Fechado no momento"}
    </span>
  );
}
