import Image from "next/image";
import StatusLoja from "./StatusLoja";

interface Props {
  busca: string;
  onBusca: (valor: string) => void;
}

export default function LojaHeader({ busca, onBusca }: Props) {
  return (
    <header className="relative">
      <div className="h-1.5 w-full bg-accent" />
      <div className="relative h-32 w-full bg-brand-700 md:h-48">
        <Image src="/capa.jpg" alt="Frutos de Goiás" fill className="object-cover opacity-90" priority />
      </div>

      <div className="mx-auto flex max-w-6xl items-end gap-3 px-4 pb-3 md:px-6">
        <div className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white p-2 shadow md:h-24 md:w-24">
          <Image src="/logo.svg" alt="Frutos de Goiás" fill className="object-contain" />
        </div>
        <div className="flex flex-1 items-start justify-between gap-3 pt-2 md:pt-4">
          <div className="min-w-0">
            <h1 className="text-base font-semibold md:text-xl">Frutos de Goiás</h1>
            <p className="text-xs text-neutral-500 md:text-sm">R. Santa Rita, 583 · Centro, Juiz de Fora</p>
          </div>
          <StatusLoja />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-3 md:px-6">
        <label className="relative block">
          <span className="sr-only">Buscar produtos</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">⌕</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => onBusca(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>
    </header>
  );
}
