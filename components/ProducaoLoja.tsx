"use client";

import { useEffect, useState } from "react";
import { getEmpresaAtual } from "@/lib/empresa";
import { supabase } from "@/lib/supabase";
import TempoProducao from "./TempoProducao";

export type ConfigProducao = {
  ativo?: boolean;
  tempo?: unknown;
  texto_livre?: boolean;
};

export default function ProducaoLoja() {
  const [config, setConfig] = useState<ConfigProducao | null>(null);
  useEffect(() => {
    let ativo = true;
    getEmpresaAtual()
      .then(async (empresa) => {
        if (!empresa) return;
        const { data, error } = await supabase
          .from("configuracoes_loja")
          .select("valor")
          .eq("empresa_id", empresa.id)
          .eq("chave", "producao")
          .maybeSingle();
        if (ativo && !error) setConfig(data?.valor ?? null);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);
  return <TempoProducao config={config} />;
}
