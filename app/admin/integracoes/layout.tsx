"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";

export default function IntegracoesLayout({ children }: { children: React.ReactNode }) {
  const [entrega, setEntrega] = useState(false);
  useEffect(() => {
    let ativo = true;
    async function atualizar() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const empresa = user ? await getEmpresaAdminAtual(user.id) : null;
        const resultado = empresa
          ? await supabase.rpc("modulo_empresa_ativo", { p_empresa_id: empresa.id, p_chave: "entrega_integrada" })
          : null;
        if (ativo) setEntrega(!resultado?.error && resultado?.data === true);
      } catch { if (ativo) setEntrega(false); }
    }
    void atualizar();
    const timer = setInterval(atualizar, 60000);
    window.addEventListener("focus", atualizar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", atualizar); };
  }, []);
  return <>
    {children}
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:flex-row">
      {entrega && <Link href="/admin/integracoes/ifood" className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-lg hover:bg-red-50">
        Configurar iFood
      </Link>}
      <Link href="/admin/integracoes/logs" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 shadow-lg hover:bg-neutral-50">
        Logs de integrações
      </Link>
    </div>
  </>;
}
