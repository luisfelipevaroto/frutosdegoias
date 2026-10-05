export type EmpresaSuperadmin = {
  id: string; nome: string; slug: string; dominio_principal: string | null;
  ativo: boolean; status: string; plano_id: string | null; criado_em: string;
  atualizado_em: string; telefone: string | null; whatsapp: string | null;
  endereco: string | null; cidade: string | null; estado: string | null; cep: string | null;
};
export type PlanoSuperadmin = { id: string; nome: string; descricao: string | null; ativo: boolean };
export type ModuloSuperadmin = { id: string; chave: string; nome: string; descricao: string | null };
export type ModuloVinculo = { modulo_id: string; ativo: boolean };
export type ModuloEmpresa = ModuloVinculo & { empresa_id: string };
export type ModuloPlano = ModuloVinculo & { plano_id: string };
export type PedidoResumo = { empresa_id: string | null; valor_total: number | string; status_pedido: string; criado_em: string };
export type CredencialResumo = { empresa_id: string; provedor: string; ambiente: string; atualizado_em: string };
export type IntegracaoResumo = { empresa_id: string; provedor: string; ativo: boolean; atualizado_em: string };
export type Metricas = { pedidos: number; pedidosMes: number; cancelados: number; gmv: number; gmvMes: number };
export type DashboardSuperadmin = {
  empresas: EmpresaSuperadmin[]; planos: PlanoSuperadmin[]; modulos: ModuloSuperadmin[];
  empresaModulos: ModuloEmpresa[]; planoModulos: ModuloPlano[];
  credenciais: CredencialResumo[]; integracoes: IntegracaoResumo[];
  metricas: Metricas; porEmpresa: Record<string, Metricas>;
  clientes: number; atualizadoEm: string; mes: string;
};

export function moduloEfetivo(empresa: EmpresaSuperadmin, moduloId: string, overrides: ModuloEmpresa[], planos: ModuloPlano[]) {
  const override = overrides.find(x => x.empresa_id === empresa.id && x.modulo_id === moduloId);
  if (override) return { ativo: override.ativo, origem: "empresa" as const };
  return { ativo: planos.find(x => x.plano_id === empresa.plano_id && x.modulo_id === moduloId)?.ativo ?? false, origem: "plano" as const };
}

export function mesSaoPaulo(data: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(data);
  return `${parts.find(x => x.type === "year")!.value}-${parts.find(x => x.type === "month")!.value}`;
}
export function metricasVazias(): Metricas { return { pedidos: 0, pedidosMes: 0, cancelados: 0, gmv: 0, gmvMes: 0 }; }
export function acumularPedidos(pedidos: PedidoResumo[], mes: string, metricas: Metricas, porEmpresa: Record<string, Metricas>) {
  for (const pedido of pedidos) {
    const destinos = [metricas];
    if (pedido.empresa_id) destinos.push(porEmpresa[pedido.empresa_id] ??= metricasVazias());
    const noMes = mesSaoPaulo(new Date(pedido.criado_em)) === mes;
    const centavos = Math.round(Number(pedido.valor_total) * 100);
    for (const m of destinos) {
      m.pedidos++; if (noMes) m.pedidosMes++;
      if (pedido.status_pedido === "cancelado") { m.cancelados++; continue; }
      m.gmv = (Math.round(m.gmv * 100) + centavos) / 100;
      if (noMes) m.gmvMes = (Math.round(m.gmvMes * 100) + centavos) / 100;
    }
  }
}

export function validarEmpresa(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Informe os dados da empresa.");
  const x = input as Record<string, unknown>;
  function texto(chave: string, max: number, obrigatorio = false) {
    if (typeof x[chave] !== "string") throw new Error(`Campo inválido: ${chave}.`);
    const value = (x[chave] as string).trim();
    if (value.length > max || (obrigatorio && !value)) throw new Error(`Verifique o campo ${chave}.`);
    return value;
  }
  const nome = texto("nome", 150, true), slug = texto("slug", 80, true).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Use letras minúsculas, números e hífens no identificador.");
  const dominio = texto("dominio_principal", 253).toLowerCase();
  if (dominio && !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(dominio)) throw new Error("Informe apenas o domínio, sem https:// ou caminhos.");
  if (typeof x.ativo !== "boolean") throw new Error("Informe se a empresa está ativa.");
  const estado = texto("estado", 2).toUpperCase();
  if (estado && !/^[A-Z]{2}$/.test(estado)) throw new Error("Use a sigla de duas letras no estado.");
  return { nome, slug, dominio_principal: dominio || null, ativo: x.ativo,
    status: x.ativo ? "ativa" : "suspensa", telefone: texto("telefone", 30) || null,
    whatsapp: texto("whatsapp", 30) || null, endereco: texto("endereco", 300) || null,
    cidade: texto("cidade", 100) || null, estado: estado || null, cep: texto("cep", 12) || null };
}

