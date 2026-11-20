"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getEmpresaAdminAtual } from "@/lib/empresa-admin";
import { moduloDaRotaPainel } from "@/lib/modulos-painel";

export default function ModuloPainel({ children }: { children: React.ReactNode }) {
  const caminho = usePathname();
  const modulo = moduloDaRotaPainel(caminho);
  const router = useRouter();
  const [autorizado, setAutorizado] = useState<string | null>(null);

  useEffect(() => {
    if (!modulo) return;
    let ativo = true;
    let verificacao = 0;
    async function verificar() {
      const atual = ++verificacao;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!ativo || atual !== verificacao) return;
        if (!user) {
          setAutorizado(null);
          router.replace("/admin/login");
          return;
        }
        const empresa = await getEmpresaAdminAtual(user.id);
        const resposta = empresa
          ? await supabase.rpc("modulo_empresa_ativo", { p_empresa_id: empresa.id, p_chave: modulo })
          : null;
        if (!ativo || atual !== verificacao) return;
        if (!resposta?.error && resposta?.data === true) setAutorizado(caminho);
        else {
          setAutorizado(null);
          router.replace("/admin");
        }
      } catch {
        if (ativo && atual === verificacao) {
          setAutorizado(null);
          router.replace("/admin");
        }
      }
    }
    void verificar();
    const timer = setInterval(verificar, 60000);
    window.addEventListener("focus", verificar);
    return () => {
      ativo = false;
      clearInterval(timer);
      window.removeEventListener("focus", verificar);
    };
  }, [modulo, caminho, router]);

  if (modulo && autorizado !== caminho) return null;
  return <>{children}</>;
}
