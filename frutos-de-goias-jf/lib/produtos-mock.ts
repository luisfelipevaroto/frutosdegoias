import { Produto } from "./types";

// Preço padrão de R$ 2,00 por variação, como pedido — troque isso pela
// tabela `produtos`/`variacoes` do Supabase quando o back-end estiver pronto.
const PRECO_PADRAO = 2;

const adicionaisMonteDoJeito = [
  { id: "granola", nome: "Granola", preco: 0 },
  { id: "leite-po", nome: "Leite em pó", preco: 0 },
  { id: "morango", nome: "Morango", preco: 0 },
  { id: "uva", nome: "Uva", preco: 0 },
  { id: "amendoim", nome: "Amendoim", preco: 0 },
  { id: "calda-chocolate", nome: "Calda de chocolate", preco: 0 },
  { id: "calda-morango", nome: "Calda de morango", preco: 0 },
  { id: "leite-condensado", nome: "Leite condensado", preco: 0 },
];

export const produtosMock: Produto[] = [
  ...["Uva", "Morango", "Chocolate", "Limão", "Maracujá"].map((sabor, i) => ({
    id: `picole-${i}`,
    categoria: "picole" as const,
    nome: `Picolé de ${sabor}`,
    ativo: true,
    variacoes: [{ id: "unidade", nome: "Unidade", preco: PRECO_PADRAO }],
  })),
  ...["Uva", "Morango", "Napolitano", "Jabuticaba", "Maracujá"].map(
    (sabor, i) => ({
      id: `sorvete-${i}`,
      categoria: "sorvete" as const,
      nome: `Sorvete de ${sabor}`,
      ativo: true,
      variacoes: [{ id: "unidade", nome: "Unidade", preco: PRECO_PADRAO }],
    })
  ),
  {
    id: "acai-tradicional",
    categoria: "acai",
    nome: "Açaí",
    ativo: true,
    variacoes: [{ id: "unidade", nome: "Unidade", preco: PRECO_PADRAO }],
  },
  {
    id: "acai-ninho",
    categoria: "acai",
    nome: "Açaí com ninho",
    ativo: true,
    variacoes: [{ id: "unidade", nome: "Unidade", preco: PRECO_PADRAO }],
  },
  {
    id: "acai-morango",
    categoria: "acai",
    nome: "Açaí com morango",
    ativo: true,
    variacoes: [{ id: "unidade", nome: "Unidade", preco: PRECO_PADRAO }],
  },
  {
    id: "monte-do-jeito",
    categoria: "monte_do_jeito",
    nome: "Monte do seu jeito",
    descricao: "Açaí no copo com os adicionais que você escolher",
    ativo: true,
    variacoes: [
      { id: "300ml", nome: "300ml", preco: PRECO_PADRAO },
      { id: "500ml", nome: "500ml", preco: PRECO_PADRAO },
    ],
    adicionaisDisponiveis: adicionaisMonteDoJeito,
  },
];
