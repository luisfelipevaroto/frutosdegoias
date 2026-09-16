export type Categoria = "sorvete" | "picole" | "acai" | "monte_do_jeito" | "paleta";

export const ROTULOS_SUBCATEGORIA: Record<string, string> = {
  tradicional: "Tradicional",
  premium: "Premium",
  gourmet: "Gourmet",
  kids: "Kids",
  proteica: "Proteica",
  zero_acucar: "Zero Açúcar",
  paleta: "Paleta",
  tradicional_1_5_l: "Tradicional 1,5L",
  premium_1_5_l: "Premium 1,5L",
  zero_acucar_1_0_l: "Zero Açúcar 1L",
  acai_1_0_l: "Açaí 1L",
  acai_1_5_l: "Açaí 1,5L",
};

export function rotuloSubcategoria(id: string): string {
  return ROTULOS_SUBCATEGORIA[id] ?? id.replace(/_/g, " ");
}

export interface Variacao {
  id: string;
  nome: string;
  preco: number;
}

export interface Adicional {
  id: string;
  nome: string;
  preco: number;
}

export interface Produto {
  id: string;
  categoria: Categoria;
  subcategoria?: string;
  nome: string;
  descricao?: string;
  foto?: string;
  ativo: boolean;
  ordem?: number;
  preco?: number;
  precoPromocional?: number;
  variacoes: Variacao[];
  adicionaisDisponiveis?: Adicional[];
}

export interface ItemCarrinho {
  produtoId: string;
  nome: string;
  variacaoId: string;
  variacaoNome: string;
  adicionais: Adicional[];
  quantidade: number;
  precoUnitario: number;
}

export type TipoEntrega = "entrega" | "retirada";
export type FormaPagamento = "pix" | "cartao" | "dinheiro";

export type StatusPedido =
  | "recebido"
  | "em_preparo"
  | "saiu_para_entrega"
  | "entregue";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  endereco?: string;
  gastoAcumuladoFidelidade: number;
  cupomDisponivel: boolean;
}

export interface Pedido {
  id: string;
  clienteId: string;
  itens: ItemCarrinho[];
  tipoEntrega: TipoEntrega;
  enderecoEntrega?: string;
  horarioRetirada?: string;
  taxaEntrega: number;
  formaPagamento: FormaPagamento;
  statusPagamento: "pendente" | "pago";
  statusPedido: StatusPedido;
  valorTotal: number;
  criadoEm: string;
}

export const HORARIO_FUNCIONAMENTO = {
  segSex: { abre: 11, fecha: 19 },
  sabDom: { abre: 11, fecha: 17 },
};

export function lojaAberta(data: Date = new Date()): boolean {
  const dia = data.getDay();
  const hora = data.getHours() + data.getMinutes() / 60;
  const { abre, fecha } =
    dia === 0 || dia === 6 ? HORARIO_FUNCIONAMENTO.sabDom : HORARIO_FUNCIONAMENTO.segSex;
  return hora >= abre && hora < fecha;
}
