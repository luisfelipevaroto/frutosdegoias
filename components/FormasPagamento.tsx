import { Pagamentos, normalizarPagamentos } from "@/lib/pagamentos";

export default function FormasPagamento({
  valor,
  alterar,
  liberado,
  provedor,
}: {
  valor: Pagamentos;
  alterar: (p: Pagamentos) => void;
  liberado: boolean;
  provedor: string | null;
}) {
  const online = liberado && !!provedor;
  const campos = [
    ["dinheiro", "Dinheiro"],
    ["cartao_entrega", "Cartão na entrega"],
    ["cartao_retirada", "Cartão de crédito no balcão (somente retirada)"],
    ["pix_manual", "Pix manual no balcão (somente retirada)"],
    ["cartao_online", "Cartão de crédito (online)"],
    ["pix_online", "Pix (online)"],
  ] as const;
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="font-bold">Formas de pagamento</h2>
      {campos.map(([campo, label]) => (
        <label
          key={campo}
          className="flex items-center justify-between gap-3 border-b py-2 text-sm"
        >
          <span>{label}</span>
          <input
            type="checkbox"
            checked={valor[campo]}
            disabled={
              ((campo === "cartao_online" || campo === "pix_online") &&
                !online) ||
              (campo === "cartao_online" && provedor === "pagbank")
            }
            onChange={(e) =>
              alterar(
                normalizarPagamentos({ ...valor, [campo]: e.target.checked }),
              )
            }
          />
        </label>
      ))}
      {!online && (
        <p className="mt-3 text-xs text-neutral-500">
          {liberado
            ? "Configure o provedor para liberar pagamentos online."
            : "Pagamento online não está incluído no plano desta empresa."}
        </p>
      )}
      {provedor === "pagbank" && (
        <p className="mt-3 text-xs text-amber-800">
          PagBank disponível para Pix online. Cartão de crédito online ainda não
          está disponível para este provedor.
        </p>
      )}
    </section>
  );
}
