"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useCarrinho } from "@/lib/carrinho-context";
import { getEmpresaAtual } from "@/lib/empresa";
import { supabase } from "@/lib/supabase";

type Cfg = {
  ativo?: boolean;
  modo?: "meta" | "cashback";
  cashback_percentual?: number;
  meta?: number;
  tipo_recompensa?: "percentual" | "fixo";
  valor_recompensa?: number;
  desconto_percentual?: number;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function FidelidadeBeneficio() {
  const pathname = usePathname();
  const { itens, subtotal } = useCarrinho();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [liberado, setLiberado] = useState(false);

  useEffect(() => {
    if (pathname !== "/carrinho" && pathname !== "/checkout") return;
    (async () => {
      const empresa = await getEmpresaAtual();
      if (!empresa) return;
      const [{ data: mod }, { data: row }] = await Promise.all([
        supabase.rpc("modulo_empresa_ativo", { p_empresa_id: empresa.id, p_chave: "fidelidade" }),
        supabase.from("configuracoes_loja").select("valor").eq("empresa_id", empresa.id).eq("chave", "fidelidade").maybeSingle(),
      ]);
      const valor = (row?.valor || {}) as Cfg;
      setLiberado(mod === true && valor.ativo === true);
      setCfg(valor);
    })();
  }, [pathname]);

  const percentual = Number(cfg?.cashback_percentual || 0);
  const totalCashback = useMemo(() => subtotal * percentual / 100, [subtotal, percentual]);
  if (!liberado || !cfg || !itens.length) return null;

  const cashback = cfg.modo === "cashback";
  const recompensa = Number(cfg.valor_recompensa ?? cfg.desconto_percentual ?? 0);
  const recompensaTexto = cfg.tipo_recompensa === "fixo" ? brl(recompensa) : `${recompensa}%`;

  return <section className="mx-auto -mt-16 max-w-md px-4 pb-20 md:-mt-12 md:pb-5">
    <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
      <div className="flex items-start gap-2"><span className="text-lg">★</span><div className="min-w-0 flex-1"><b>Este pedido participa do programa de fidelidade</b>
        {cashback ? <p className="mt-1 text-xs text-green-800">Você recebe <b>{percentual}% de cashback</b> nos produtos após a conclusão do pedido.</p> : <p className="mt-1 text-xs text-green-800">O valor dos produtos entra na sua meta de fidelidade. Ao atingir {brl(Number(cfg.meta || 0))}, a recompensa é de <b>{recompensaTexto}</b>.</p>}
      </div></div>
      {cashback && <div className="mt-3 border-t border-green-200 pt-3">
        <div className="space-y-1.5">{itens.map((item, i) => { const valor = Number(item.precoUnitario) * Number(item.quantidade); const ganho = valor * percentual / 100; return <div key={i} className="flex justify-between gap-3 text-xs"><span className="truncate">{item.quantidade}× {item.nome}</span><b className="shrink-0">+ {brl(ganho)}</b></div>; })}</div>
        <div className="mt-2 flex justify-between border-t border-green-200 pt-2 font-semibold"><span>Cashback estimado</span><span>+ {brl(totalCashback)}</span></div>
      </div>}
    </div>
  </section>;
}
