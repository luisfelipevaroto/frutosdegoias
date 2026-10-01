import Link from "next/link";

export default function IntegracoesLayout({children}:{children:React.ReactNode}){
  return <>
    {children}
    <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 sm:flex-row">
      <Link href="/admin/integracoes/ifood" className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 shadow-lg hover:bg-red-50">
        Configurar iFood
      </Link>
      <Link href="/admin/integracoes/logs" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-700 shadow-lg hover:bg-neutral-50">
        Logs de integrações
      </Link>
    </div>
  </>
}
