import Image from "next/image";
import StatusLoja from "./StatusLoja";

export default function LojaHeader() {
  return (
    <header className="relative">
      {/* Faixa amarela de destaque — toque da identidade visual da marca */}
      <div className="h-1.5 w-full bg-accent" />

      {/* Capa — troque /public/capa.jpg pela foto real da loja */}
      <div className="relative h-32 w-full bg-brand-700 md:h-48">
        <Image
          src="/capa.jpg"
          alt="Frutos de Goiás"
          fill
          className="object-cover opacity-90"
          priority
        />
      </div>

      <div className="mx-auto flex max-w-6xl items-end gap-3 px-4 pb-3 md:px-6">
        {/* Logo oficial */}
        <div className="relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-white p-2 shadow md:h-24 md:w-24">
          <Image src="/logo.svg" alt="Frutos de Goiás" fill className="object-contain" />
        </div>

        <div className="flex flex-1 items-start justify-between pt-2 md:pt-4">
          <div>
            <h1 className="text-base font-semibold md:text-xl">
              Frutos de Goiás
            </h1>
            <p className="text-xs text-neutral-500 md:text-sm">
              R. Santa Rita, 583 · Centro, Juiz de Fora
            </p>
          </div>
          <StatusLoja />
        </div>
      </div>
    </header>
  );
}
