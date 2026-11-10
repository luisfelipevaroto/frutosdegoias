"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { textoProducao } from "@/lib/producao";

export default function ConfigProducao({ empresaId }: { empresaId: string }) {
  const [config, setConfig] = useState({ ativo: false, tempo: "" });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  useEffect(() => {
    if (!empresaId) return;
    let ativo = true;
    supabase
      .from("configuracoes_loja")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("chave", "producao")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error)
          setMensagem("Não foi possível carregar o tempo de produção.");
        else
          setConfig({
            ativo: data?.valor?.ativo === true,
            tempo: textoProducao(
              data?.valor?.tempo,
              data?.valor?.texto_livre === true,
            ),
          });
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [empresaId]);

  async function salvar() {
    if (!empresaId || salvando) return;
    if (config.ativo && !config.tempo.trim()) {
      setMensagem("Preencha o tempo estimado antes de ativar.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("configuracoes_loja").upsert(
      {
        empresa_id: empresaId,
        chave: "producao",
        valor: { ...config, texto_livre: true },
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "empresa_id,chave" },
    );
    setMensagem(error ? error.message : "Tempo de produção salvo.");
    setSalvando(false);
  }

  return (
    <section className="rounded-xl border bg-white p-5">
      <h2 className="mb-3 font-semibold">Tempo estimado de produção</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Exibido no cabeçalho, no carrinho e antes da confirmação do pedido.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={config.ativo}
          disabled={carregando || salvando}
          onChange={(e) => setConfig({ ...config, ativo: e.target.checked })}
        />
        Exibir para os clientes
      </label>
      <label htmlFor="config-tempo-producao" className="mt-3 block text-sm">
        Estimativa de produção
      </label>
      <textarea
        id="config-tempo-producao"
        value={config.tempo}
        rows={3}
        maxLength={500}
        disabled={carregando || salvando}
        onChange={(e) => setConfig({ ...config, tempo: e.target.value })}
        placeholder="Ex. de 30 a 40 minutos"
        className="mt-2 w-full rounded-lg border p-3 text-sm"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={carregando || salvando}
        className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "Salvar tempo de produção"}
      </button>
      {mensagem && (
        <p role="status" className="mt-3 text-sm">
          {mensagem}
        </p>
      )}
    </section>
  );
}
