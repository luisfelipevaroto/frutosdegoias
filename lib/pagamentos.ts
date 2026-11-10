export type Pagamentos = {
  dinheiro: boolean;
  cartao_entrega: boolean;
  cartao_retirada: boolean;
  cartao_online: boolean;
  pix_online: boolean;
  online: boolean;
  pix_manual: boolean;
};

export function normalizarPagamentos(valor: any): Pagamentos {
  const pix =
    typeof valor?.pix_online === "boolean"
      ? valor.pix_online
      : valor?.online === true;
  const cartao = valor?.cartao_online === true;
  return {
    dinheiro: valor?.dinheiro === true,
    cartao_entrega: valor?.cartao_entrega === true,
    cartao_retirada: valor?.cartao_retirada === true,
    cartao_online: cartao,
    pix_online: pix,
    online: pix || cartao,
    pix_manual: valor?.pix_manual === true,
  };
}

export function provedorConfigurado(status: any[]) {
  const rows = (status ?? []).filter(
    (x) =>
      ["mercado_pago", "pagbank"].includes(x.provedor) &&
      x.configurado === true,
  );
  return rows.length === 1
    ? (rows[0].provedor as "mercado_pago" | "pagbank")
    : null;
}

export function provedorDisponivel(status: any[]) {
  const rows = (status ?? []).filter(
    (x) => ["mercado_pago", "pagbank"].includes(x.provedor) && x.ativo === true,
  );
  return rows.length === 1
    ? (rows[0].provedor as "mercado_pago" | "pagbank")
    : null;
}

export function pagamentoPermitido(
  config: any,
  status: any[],
  pagamento: unknown,
  online: unknown,
  tipoEntrega: unknown = "entrega",
) {
  const cfg = normalizarPagamentos(config);
  if (online === true) {
    const provider = provedorDisponivel(status);
    if (pagamento === "pix") return !!provider && cfg.pix_online;
    return (
      provider === "mercado_pago" && pagamento === "cartao" && cfg.cartao_online
    );
  }
  if (pagamento === "dinheiro") return cfg.dinheiro;
  if (pagamento === "cartao")
    return tipoEntrega === "retirada"
      ? cfg.cartao_retirada
      : cfg.cartao_entrega;
  return tipoEntrega === "retirada" && pagamento === "pix" && cfg.pix_manual;
}

export function rotuloPagamento(pedido: {
  forma_pagamento?: string;
  tipo_entrega?: string;
  provedor_pagamento?: string | null;
}) {
  if (pedido.forma_pagamento === "dinheiro") return "Dinheiro";
  if (pedido.provedor_pagamento)
    return pedido.forma_pagamento === "pix"
      ? "Pix online"
      : "Cartão de crédito online";
  if (pedido.forma_pagamento === "pix") return "Pix manual no balcão";
  return pedido.tipo_entrega === "retirada"
    ? "Cartão de crédito no balcão"
    : "Cartão na entrega";
}
