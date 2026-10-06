import { textoProducao } from "@/lib/producao";
export default function TempoProducao({config}:{config?:{ativo?:boolean;tempo?:unknown;texto_livre?:boolean}|null}) {
  const texto=textoProducao(config?.tempo,config?.texto_livre===true);
  if(!config?.ativo||!texto.trim())return null;
  return <section className="mt-3 min-w-0 rounded-xl border border-brand-100 bg-brand-50 p-4">
    <h3 className="text-xs font-semibold text-brand-800">Tempo estimado de produção</h3>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-brand-700 [overflow-wrap:anywhere]">{texto}</p>
  </section>;
}
