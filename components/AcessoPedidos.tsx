"use client";
import Link from "next/link";
import { usePedidos } from "@/lib/use-pedidos";
export default function AcessoPedidos({ children }: { children: React.ReactNode }) {
  const permitido = usePedidos();
  if (permitido === null) return <p className="p-6" role="status">Carregando…</p>;
  if (!permitido) return <main className="mx-auto max-w-md p-6"><h1 className="text-lg font-bold">Cardápio visual</h1><p className="mt-3 text-sm">Esta loja oferece seu cardápio para consulta.</p><Link href="/" className="mt-4 inline-block text-brand-700">Voltar ao cardápio</Link></main>;
  return <>{children}</>;
}

