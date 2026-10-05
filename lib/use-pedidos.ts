"use client";
import { useEffect, useState } from "react";
import { getEmpresaAtual } from "./empresa";
import { supabase } from "./supabase";
export function usePedidos(enabled = true) {
  const [permitido, setPermitido] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    if (enabled) getEmpresaAtual().then(async empresa => {
      if (!empresa) { if (alive) setPermitido(false); return; }
      const { data, error } = await supabase.rpc("modulo_empresa_ativo", { p_empresa_id: empresa.id, p_chave: "pedidos" });
      if (alive) setPermitido(!error && data === true);
    }).catch(() => { if (alive) setPermitido(false); });
    return () => { alive = false; };
  }, [enabled]);
  return permitido;
}

