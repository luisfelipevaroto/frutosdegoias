import "./globals.css";
import { CarrinhoProvider } from "@/lib/carrinho-context";
import BottomNav from "@/components/BottomNav";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const h = headers();
  const rawHost = h.get("x-forwarded-host") || h.get("host") || "";
  const host = rawHost.split(",")[0].trim().split(":")[0].toLowerCase();
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.rpc("empresa_por_dominio", { p_dominio: host });
    const empresa = Array.isArray(data) ? data[0] : data;
    if (empresa?.nome) {
      const local = [empresa.cidade, empresa.estado].filter(Boolean).join(" - ");
      const title = `${empresa.nome}${local ? ` | ${local}` : ""}`;
      const description = `Faça seu pedido online na ${empresa.nome}${local ? ` em ${local}` : ""}. Consulte o cardápio, escolha seus produtos e finalize seu pedido.`;
      return { title, description, openGraph: { title, description, type: "website" } };
    }
  } catch (e) { console.error("Erro ao gerar metadata da empresa", e); }
  return { title: "Delivery Online", description: "Consulte o cardápio e faça seu pedido online." };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body className="bg-neutral-50 text-neutral-900"><CarrinhoProvider><div className="pb-16 md:pb-0">{children}</div><BottomNav /></CarrinhoProvider></body></html>;
}
