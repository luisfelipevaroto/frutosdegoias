export type Categoria = string;

export const ROTULOS_SUBCATEGORIA: Record<string, string> = {
  tradicional: "Tradicional", premium: "Premium", gourmet: "Gourmet", kids: "Kids", proteica: "Proteica", zero_acucar: "Zero Açúcar", paleta: "Paleta", tradicional_1_5_l: "Tradicional 1,5L", premium_1_5_l: "Premium 1,5L", zero_acucar_1_0_l: "Zero Açúcar 1L", acai_1_0_l: "Açaí 1L", acai_1_5_l: "Açaí 1,5L",
};
export function rotuloSubcategoria(id: string): string { return ROTULOS_SUBCATEGORIA[id] ?? id.replace(/_/g, " "); }
export function rotuloCategoria(id: string): string { const conhecidos:Record<string,string>={picole:"Picolés",sorvete:"Sorvetes",paleta:"Paletas",acai:"Açaí",monte_do_jeito:"Monte do seu jeito",hamburguer:"Hambúrgueres",pizza:"Pizzas",bebida:"Bebidas",sobremesa:"Sobremesas"};if(conhecidos[id])return conhecidos[id];return id.replace(/_/g," ").replace(/\b\w/g,l=>l.toUpperCase()); }
export interface Variacao { id:string;nome:string;preco:number }
export interface Adicional { id:string;nome:string;preco:number }
export interface Produto { id:string;categoria:Categoria;categoriaId?:string;categoriaOrdem?:number;subcategoria?:string;subcategoriaId?:string;subcategoriaOrdem?:number;nome:string;descricao?:string;foto?:string;ativo:boolean;ordem?:number;preco?:number;precoPromocional?:number;variacoes:Variacao[];adicionaisDisponiveis?:Adicional[] }
export interface ItemCarrinho { produtoId:string;nome:string;variacaoId:string;variacaoNome:string;adicionais:Adicional[];quantidade:number;precoUnitario:number }
export type TipoEntrega="entrega"|"retirada";export type FormaPagamento="pix"|"cartao"|"dinheiro";export type StatusPedido="recebido"|"em_preparo"|"saiu_para_entrega"|"entregue";
export interface Cliente{id:string;nome:string;telefone:string;cpf:string;endereco?:string;gastoAcumuladoFidelidade:number;cupomDisponivel:boolean}
export interface Pedido{id:string;clienteId:string;itens:ItemCarrinho[];tipoEntrega:TipoEntrega;enderecoEntrega?:string;horarioRetirada?:string;taxaEntrega:number;formaPagamento:FormaPagamento;statusPagamento:"pendente"|"pago";statusPedido:StatusPedido;valorTotal:number;criadoEm:string}
export type HorarioDia={abre?:string;fecha?:string;fechado?:boolean};export type HorariosLoja=Record<string,HorarioDia>;const NOMES_DIAS=["domingo","segunda","terca","quarta","quinta","sexta","sabado"];
export function lojaAberta(horarios?:HorariosLoja|null,data:Date=new Date()):boolean{if(!horarios)return false;const regra=horarios[NOMES_DIAS[data.getDay()]];if(!regra||regra.fechado||!regra.abre||!regra.fecha)return false;const minutos=data.getHours()*60+data.getMinutes();const paraMinutos=(valor:string)=>{const[h,m]=valor.split(":").map(Number);return h*60+m};const abre=paraMinutos(regra.abre),fecha=paraMinutos(regra.fecha);if(fecha>abre)return minutos>=abre&&minutos<fecha;return minutos>=abre||minutos<fecha}
