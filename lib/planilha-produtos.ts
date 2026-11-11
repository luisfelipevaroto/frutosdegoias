import type { Workbook, Worksheet } from "exceljs";

export const AVISO_VARIACOES = "atualização via planilha não atualiza produtos com variação, somente produtos simples";
export const LIMITE_LINHAS = 3000;
const COLUNAS = [
  ["id", "ID do produto"],
  ["nome", "Nome"],
  ["descricao", "Descrição"],
  ["categoria", "Categoria"],
  ["subcategoria", "Subcategoria"],
  ["preco", "Preço"],
  ["preco_promocional", "Preço promocional"],
  ["ativo", "Ativo"],
] as const;

export type LinhaProduto = Record<(typeof COLUNAS)[number][0], string>;
export type DadosProduto = {
  nome: string;
  descricao: string | null;
  categoria: string;
  subcategoria: string | null;
  preco: number | null;
  preco_promocional: number | null;
  ativo: boolean;
};
export type ProdutoExportado = DadosProduto & {
  id: string;
  categoria_id: string | null;
  subcategoria_id: string | null;
  variacoes: { nome: string; preco: number }[];
};
export type CategoriaPlanilha = { id: string; nome: string };
export type SubcategoriaPlanilha = CategoriaPlanilha & { categoria_id: string };

export async function lerPlanilhaProdutos(file: File) {
  if (!/\.xlsx$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
    throw new Error("Selecione um arquivo Excel (.xlsx) de até 5 MB.");
  }
  const { Workbook } = await import("exceljs");
  const arquivo = new Workbook();
  try {
    await arquivo.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("Não foi possível abrir o arquivo Excel. Baixe o modelo do painel.");
  }
  const aba = arquivo.getWorksheet("Produtos");
  if (!aba || COLUNAS.some(([, rotulo], i) => aba.getRow(1).getCell(i + 1).value !== rotulo)) {
    throw new Error("A aba Produtos precisa dos cabeçalhos do modelo, na mesma ordem.");
  }
  if (aba.rowCount > LIMITE_LINHAS + 1) {
    throw new Error("Importe até 3.000 linhas de produtos por arquivo.");
  }

  const linhas: (LinhaProduto | null)[] = [];
  for (let numero = 1; numero <= aba.rowCount; numero++) {
    const linha = aba.getRow(numero);
    linha.eachCell((celula, coluna) => {
      if (coluna > COLUNAS.length && celula.value != null) {
        throw new Error(`Linha ${numero} · Há colunas extras na aba Produtos.`);
      }
    });
    if (numero === 1) continue;
    const valores = COLUNAS.map(([, rotulo], i) => {
      const valor = linha.getCell(i + 1).value;
      if (valor == null) return "";
      if (typeof valor === "string") return valor;
      if ((i === 5 || i === 6) && typeof valor === "number" && Number.isFinite(valor)) {
        return String(valor);
      }
      throw new Error(`Linha ${numero} · Valor inválido em ${rotulo}. Use valores fixos em vez de fórmulas.`);
    });
    linhas.push(valores.some(valor => valor.trim())
      ? Object.fromEntries(COLUNAS.map(([chave], i) => [chave, valores[i]])) as LinhaProduto
      : null);
  }
  if (!linhas.some(Boolean)) throw new Error("Preencha pelo menos uma linha na aba Produtos.");
  return linhas;
}

function cabecalho(aba: Worksheet, titulos: readonly string[], larguras: number[]) {
  aba.addRow([...titulos]);
  aba.views = [{ state: "frozen", ySplit: 1 }];
  titulos.forEach((_, i) => { aba.getColumn(i + 1).width = larguras[i] ?? 22; });
  const linha = aba.getRow(1);
  linha.font = { bold: true, color: { argb: "FFFFFFFF" } };
  linha.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
  linha.height = 22;
}

function montarPlanilha(
  arquivo: Workbook,
  categorias: CategoriaPlanilha[],
  subcategorias: SubcategoriaPlanilha[],
  produtos: ProdutoExportado[],
) {
  const aba = arquivo.addWorksheet("Produtos");
  const instrucoes = arquivo.addWorksheet("Instruções");
  const listaCategorias = arquivo.addWorksheet("Categorias");
  const nomes = new Map(categorias.map(c => [c.id, c.nome]));
  const nomesSub = new Map(subcategorias.map(s => [s.id, s.nome]));
  const titulos = COLUNAS.map(([, rotulo]) => rotulo);
  const larguras = [40, 34, 48, 25, 25, 14, 19, 12];
  cabecalho(aba, titulos, larguras);
  aba.getColumn(6).numFmt = "0.00";
  aba.getColumn(7).numFmt = "0.00";
  aba.autoFilter = "A1:H1";

  cabecalho(instrucoes, ["Como preencher a aba Produtos"], [105]);
  instrucoes.addRows([
    [AVISO_VARIACOES],
    ["Para cadastrar, deixe o ID do produto vazio. Para atualizar, mantenha o ID exportado."],
    ["Preencha Nome, Categoria, Preço e Ativo. Use Sim ou Não em Ativo."],
    ["Copie os nomes de categoria e subcategoria da aba Categorias."],
    ["Descrição, Subcategoria e Preço promocional vazios limpam o campo na atualização."],
    ["Use preços com até duas casas decimais e valor promocional menor que o preço normal."],
    ["Mantenha os cabeçalhos e importe até 3.000 linhas por arquivo. Confira a prévia antes de confirmar."],
    ["Exemplo de novo produto"],
  ]);
  instrucoes.getRow(1).height = 22;
  instrucoes.getColumn(1).alignment = { wrapText: true };
  // Keep the example out of the importable sheet so it cannot be created by accident.
  const exemplo = arquivo.addWorksheet("Exemplo");
  cabecalho(exemplo, titulos, larguras);
  exemplo.addRow(["", "Produto de exemplo", "", categorias[0]?.nome ?? "", "", 19.9, "", "Sim"]);

  cabecalho(listaCategorias, ["Categoria", "Subcategoria"], [34, 34]);
  for (const categoria of categorias) listaCategorias.addRow([categoria.nome, ""]);
  for (const sub of subcategorias) {
    listaCategorias.addRow([nomes.get(sub.categoria_id) ?? "", sub.nome]);
  }

  const comVariacoes = produtos.filter(p => p.variacoes.length);
  const consulta = comVariacoes.length ? arquivo.addWorksheet("Com variações") : null;
  if (consulta) cabecalho(consulta, [...titulos, "Variação", "Preço da variação"], [...larguras, 28, 21]);
  for (const produto of produtos) {
    const dados = [
      produto.id, produto.nome, produto.descricao ?? "",
      nomes.get(produto.categoria_id ?? "") ?? produto.categoria,
      nomesSub.get(produto.subcategoria_id ?? "") ?? produto.subcategoria ?? "",
      produto.preco, produto.preco_promocional, produto.ativo ? "Sim" : "Não",
    ];
    if (produto.variacoes.length) {
      for (const variacao of produto.variacoes) consulta?.addRow([...dados, variacao.nome, variacao.preco]);
    } else {
      aba.addRow(dados);
    }
  }
}

export async function baixarPlanilhaProdutos(
  categorias: CategoriaPlanilha[],
  subcategorias: SubcategoriaPlanilha[],
  produtos?: ProdutoExportado[],
) {
  const { Workbook } = await import("exceljs");
  const arquivo = new Workbook();
  montarPlanilha(arquivo, categorias, subcategorias, produtos ?? []);
  const buffer = await arquivo.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const link = document.createElement("a");
  link.href = url;
  link.download = produtos ? "catalogo-produtos.xlsx" : "modelo-produtos.xlsx";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
