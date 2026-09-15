export type Categoria = "sorvete" | "picole" | "acai" | "monte_do_jeito";

// Subcategorias usadas para separar as linhas de picolé.
// Se no futuro quiser subcategorias em outras categorias, é só usar
// o mesmo campo `subcategoria` nos produtos daquela categoria.
export const SUBCATEGORIAS_PICOLE: { id: string; label: string }[] = [
  { id: "tradicional", label: "Tradicional" },
  { id: "premium", label: "Premium" },
  { id: "kids", label: "Kids" },
  { id: "zero_lactose", label: "Zero Lactose" },
  { id: "paleta", label: "Paleta" },
  { id: "proteico", label: "Proteico" },
];

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
