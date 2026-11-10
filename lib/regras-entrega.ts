export type ConfigEntrega = {
  retirada?: boolean;
  propria?: boolean;
  integrada?: boolean;
  taxa?: number;
  cep_inicio?: string;
  cep_fim?: string;
  frete_gratis_ativo?: boolean;
  frete_gratis_minimo?: number;
  uber_direct?: boolean;
  ifood?: boolean;
  entrega_99?: boolean;
};

export function limparCep(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

export function cepNaFaixa(cep: unknown, config: ConfigEntrega): boolean {
  const destino = limparCep(cep);
  const inicio = limparCep(config.cep_inicio);
  const fim = limparCep(config.cep_fim);
  return (
    [destino, inicio, fim].every((v) => /^\d{8}$/.test(v)) &&
    inicio <= fim &&
    destino >= inicio &&
    destino <= fim
  );
}

export function freteGratisAplicavel(
  config: ConfigEntrega,
  liberado: boolean,
  valorProdutos: number,
): boolean {
  const minimo = Number(config.frete_gratis_minimo);
  return (
    liberado &&
    config.frete_gratis_ativo === true &&
    Number.isFinite(minimo) &&
    minimo >= 0 &&
    Math.round(valorProdutos * 100) >= Math.round(minimo * 100)
  );
}

export function normalizarEntrega(config: ConfigEntrega): ConfigEntrega {
  return {
    ...config,
    uber_direct: config.integrada === true && config.uber_direct === true,
    ifood: config.integrada === true && config.ifood === true,
    entrega_99: config.integrada === true && config.entrega_99 === true,
  };
}
