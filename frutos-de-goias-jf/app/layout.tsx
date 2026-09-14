import "./globals.css";
import { CarrinhoProvider } from "@/lib/carrinho-context";

export const metadata = {
  title: "Frutos de Goiás | Juiz de Fora",
  description: "Peça sorvetes, picolés e açaí direto da loja, sem taxa de app.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-50 text-neutral-900">
        <CarrinhoProvider>{children}</CarrinhoProvider>
      </body>
    </html>
  );
}
