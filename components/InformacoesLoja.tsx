"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Empresa } from "@/lib/empresa";
import { HorariosLoja, lojaAberta } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { textoProducao } from "@/lib/producao";

const DIAS = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];
const ROTULOS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export default function InformacoesLoja({
  empresa,
}: {
  empresa: Empresa | null;
}) {
  const [agora, setAgora] = useState<Date | null>(null);
  const [producao, setProducao] = useState("");
  const [popup, setPopup] = useState<"horarios" | "producao" | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titulo = useId();
  useEffect(() => {
    const atualizar = () => setAgora(new Date());
    atualizar();
    const timer = setInterval(atualizar, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let ativo = true;
    setProducao("");
    if (empresa)
      supabase
        .from("configuracoes_loja")
        .select("valor")
        .eq("empresa_id", empresa.id)
        .eq("chave", "producao")
        .maybeSingle()
        .then(({ data, error }) => {
          if (ativo && !error && data?.valor?.ativo)
            setProducao(
              textoProducao(data.valor.tempo, data.valor.texto_livre === true),
            );
        });
    return () => {
      ativo = false;
    };
  }, [empresa]);
  useEffect(() => {
    if (!popup) return;
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const teclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopup(null);
      if (event.key !== "Tab") return;
      const botoes = dialog.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex="0"]',
      );
      if (!botoes?.length) return;
      const primeiro = botoes[0],
        ultimo = botoes[botoes.length - 1];
      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", teclado);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", teclado);
      anterior?.focus();
    };
  }, [popup]);
  if (!empresa || !agora) return null;
  // Store schedules use the Brazilian store's wall clock, independently of the visitor's timezone.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(agora);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  const local = new Date(
    valor("year"),
    valor("month") - 1,
    valor("day"),
    valor("hour"),
    valor("minute"),
  );
  const horarios = empresa.configuracoes?.horarios as HorariosLoja | undefined;
  const aberta = lojaAberta(horarios, local);
  const hoje = local.getDay();
  const fecha = horarios?.[DIAS[hoje]]?.fecha;
  const status = aberta ? "Aberto agora" : "Loja fechada";
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPopup("horarios")}
          aria-haspopup="dialog"
          className={`inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${aberta ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status}
          <span aria-hidden="true">›</span>
        </button>
        {producao.trim() && (
          <button
            type="button"
            onClick={() => setPopup("producao")}
            aria-haspopup="dialog"
            aria-label="Ver tempo estimado de produção"
            className="inline-flex min-h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600"
          >
            <svg
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v5l3 2M9 2h6" />
            </svg>
            <span className="max-w-40 truncate">
              {producao.length <= 28
                ? `Produção ${producao}`
                : "Tempo de produção"}
            </span>
            <span aria-hidden="true">›</span>
          </button>
        )}
      </div>
      {popup && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onClick={() => setPopup(null)}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titulo}
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white text-neutral-900 shadow-xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h2 id={titulo} className="text-sm font-semibold">
                {popup === "horarios"
                  ? "Horários de funcionamento"
                  : "Tempo estimado de produção"}
              </h2>
              <button
                type="button"
                aria-label="Fechar popup"
                onClick={() => setPopup(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-2xl text-neutral-500 hover:bg-neutral-100"
              >
                ×
              </button>
            </div>
            <div className="p-4 pb-6">
              {popup === "producao" ? (
                <p className="whitespace-pre-wrap break-words rounded-xl bg-neutral-50 p-4 text-sm leading-relaxed">
                  {producao}
                </p>
              ) : (
                <>
                  <div className="mb-3 rounded-xl bg-neutral-100 p-4 text-xs">
                    <p
                      className={`flex items-center gap-2 font-semibold ${aberta ? "text-green-600" : "text-red-600"}`}
                    >
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {status}
                    </p>
                    {aberta && fecha && (
                      <p className="mt-1 pl-4 text-neutral-600">
                        Hoje atendemos até {fecha}.
                      </p>
                    )}
                  </div>
                  {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                    const regra = horarios?.[DIAS[dia]];
                    const fechado =
                      !regra || regra.fechado || !regra.abre || !regra.fecha;
                    return (
                      <div
                        key={dia}
                        className={`flex items-center justify-between gap-3 rounded-lg px-2 py-3 text-xs ${dia === hoje ? "bg-orange-50 font-semibold" : "border-b border-neutral-100"}`}
                      >
                        <span>
                          {ROTULOS[dia]}
                          {dia === hoje && (
                            <span className="ml-1.5 text-[9px] font-bold text-orange-600">
                              HOJE
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            fechado ? "text-neutral-500" : "font-semibold"
                          }
                        >
                          {fechado
                            ? "Fechado"
                            : `${regra.abre} às ${regra.fecha}`}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
