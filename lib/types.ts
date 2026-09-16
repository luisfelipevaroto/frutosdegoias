export type Categoria = "sorvete" | "picole" | "acai" | "monte_do_jeito" | "paleta";

// Rótulos amigáveis das subcategorias. Chave = valor gravado no banco.
// Subcategoria que não estiver aqui ainda aparece normalmente (o rótulo vira
// o próprio valor com espaços), então dá pra criar novas no banco sem mexer no código.
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
  nome: string; // "unidade", "300ml", "500ml"
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
  subcategoria?: string; // ex: "tradicional", "premium" — hoje usado só em picolé
  nome: string;
  descricao?: string;
  foto?: string;
  ativo: boolean;
  preco?: number; // usado quando o produto NÃO tem variações (ex: picolé, sorvete)
  precoPromocional?: number; // se preenchido e menor que `preco`, mostra como oferta
  variacoes: Variacao[]; // usado quando o produto TEM variações (ex: Monte do seu Jeito)
  adicionaisDisponiveis?: Adicional[]; // usado no "Monte do seu jeito"
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
  | "saiu_para_entrega" // ou "pronto_para_retirada"
  | "entregue";

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  cpf: string;
  endereco?: string;
  gastoAcumuladoFidelidade: number; // reseta ao usar o desconto de 10%
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
  const dia = data.getDay(); // 0 = domingo, 6 = sábado
  const hora = data.getHours() + data.getMinutes() / 60;
  const { abre, fecha } =
    dia === 0 || dia === 6
      ? HORARIO_FUNCIONAMENTO.sabDom
      : HORARIO_FUNCIONAMENTO.segSex;
  return hora >= abre && hora < fecha;
}
