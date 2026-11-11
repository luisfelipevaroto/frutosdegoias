"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  AVISO_VARIACOES, baixarPlanilhaProdutos, lerPlanilhaProdutos,
  type CategoriaPlanilha, type DadosProduto, type LinhaProduto,
  type ProdutoExportado, type SubcategoriaPlanilha,
} from "@/lib/planilha-produtos";

type Alteracao = { linha: number; antes: DadosProduto | null; depois: DadosProduto };
type Previa = {
  erros: { linha: number; mensagem: string }[];
  itens: Alteracao[];
  confirmacao: string;
  criados: number;
  atualizados: number;
  iguais: number;
};

const CAMPOS: [keyof DadosProduto, string][] = [
  ["nome", "Nome"], ["descricao", "Descrição"], ["categoria", "Categoria"],
  ["subcategoria", "Subcategoria"], ["preco", "Preço"],
  ["preco_promocional", "Preço promocional"], ["ativo", "Ativo"],
];
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const botao = "rounded-lg border px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50";

function valorFormatado(valor: DadosProduto[keyof DadosProduto]) {
  if (valor === null || valor === "") return "Vazio";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") return moeda.format(valor);
  return valor;
}

export default function PlanilhaProdutosAdmin({ empresaId, categorias, subcategorias, aoImportar }: {
  empresaId: string;
  categorias: CategoriaPlanilha[];
  subcategorias: SubcategoriaPlanilha[];
  aoImportar: () => Promise<void>;
}) {
  const campoArquivo = useRef<HTMLInputElement>(null);
  const [linhas, setLinhas] = useState<(LinhaProduto | null)[]>([]);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  async function baixar(exportar: boolean) {
    setOcupado(true);
    setErro("");
    try {
      const produtos: ProdutoExportado[] = [];
      if (exportar) {
        const limite = 500;
        for (let inicio = 0; ; inicio += limite) {
          const { data, error } = await supabase.from("produtos")
            .select("id,nome,descricao,categoria,categoria_id,subcategoria,subcategoria_id,preco,preco_promocional,ativo,variacoes(nome,preco)")
            .eq("empresa_id", empresaId).order("id").range(inicio, inicio + limite - 1);
          if (error) throw new Error("Não foi possível exportar os produtos.");
          produtos.push(...data);
          if (data.length < limite) break;
        }
      }
      await baixarPlanilhaProdutos(categorias, subcategorias, exportar ? produtos : undefined);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível baixar a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  async function consultar(dados: (LinhaProduto | null)[], confirmacao?: string): Promise<Previa> {
    const { data, error } = await supabase.rpc("importar_produtos_planilha", {
      p_empresa_id: empresaId, p_linhas: dados, p_confirmacao: confirmacao ?? null,
    });
    if (error?.code === "40001") throw new Error("O catálogo mudou desde a prévia. Selecione a planilha novamente.");
    if (error?.code === "22023") throw new Error(error.message);
    if (error || !data) throw new Error("Não foi possível processar a planilha. Tente novamente.");
    return data;
  }

  async function validar(file: File) {
    setOcupado(true);
    setArquivo(file.name);
    setPrevia(null);
    setErro("");
    setMensagem("");
    try {
      const dados = await lerPlanilhaProdutos(file);
      setPrevia(await consultar(dados));
      setLinhas(dados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível validar a planilha.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    if (!previa || previa.erros.length || !previa.itens.length || ocupado) return;
    setOcupado(true);
    setErro("");
    try {
      const resultado = await consultar(linhas, previa.confirmacao);
      if (resultado.erros.length) {
        setPrevia(resultado);
        return;
      }
      setPrevia(null);
      setArquivo("");
      setLinhas([]);
      setMensagem(`Importação concluída. ${resultado.criados} criados e ${resultado.atualizados} atualizados.`);
      await aoImportar();
    } catch (e) {
      setPrevia(null);
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar a importação.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="mb-5 space-y-3 rounded-xl border bg-white p-4">
      <h2 className="font-semibold">Produtos por planilha</h2>
      <p className="text-sm text-neutral-700">{AVISO_VARIACOES}</p>
      <div className="flex flex-wrap gap-2">
        <button className={botao} type="button" disabled={ocupado} onClick={() => void baixar(false)}>Baixar modelo Excel</button>
        <button className={botao} type="button" disabled={ocupado} onClick={() => void baixar(true)}>Exportar produtos atuais</button>
        <button className={botao} type="button" disabled={ocupado} onClick={() => campoArquivo.current?.click()}>Selecionar planilha</button>
        <input ref={campoArquivo} type="file" accept=".xlsx" hidden onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void validar(file);
        }} />
      </div>
      {arquivo && <p className="break-all text-sm text-neutral-600">{arquivo}</p>}
      {ocupado && <p role="status" className="text-sm text-neutral-600">Processando planilha…</p>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      {mensagem && <p role="status" className="text-sm text-green-700">{mensagem}</p>}
      {previa && (
        <div className="space-y-3 rounded-lg bg-neutral-50 p-3 text-sm">
          <h3 className="font-semibold">Prévia da importação</h3>
          <p>{previa.criados} novos · {previa.atualizados} para atualizar · {previa.iguais} sem alterações</p>
          {previa.erros.length > 0 && (
            <div role="alert" className="text-red-700">
              <p className="font-medium">Corrija as linhas abaixo e selecione a planilha novamente.</p>
              <ul className="mt-1 max-h-52 space-y-1 overflow-auto">
                {previa.erros.map(({ linha, mensagem }) => <li key={linha}>Linha {linha} · {mensagem}</li>)}
              </ul>
            </div>
          )}
          {previa.itens.length > 0 && (
            <ul className="max-h-72 divide-y overflow-auto">
              {previa.itens.map(({ linha, antes, depois }) => (
                <li key={linha} className="break-words py-2">
                  <p className="font-medium">Linha {linha} · {antes ? "Atualizar" : "Criar"} {depois.nome}</p>
                  <ul className="text-neutral-600">
                    {CAMPOS.filter(([chave]) => !antes || antes[chave] !== depois[chave]).map(([chave, rotulo]) => (
                      <li key={chave}>
                        {rotulo} · {antes && <>{valorFormatado(antes[chave])} → </>}{valorFormatado(depois[chave])}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {previa.erros.length === 0 && previa.itens.length > 0 && (
            <button className="rounded-lg bg-green-700 px-3 py-2 font-semibold text-white disabled:opacity-50" type="button" disabled={ocupado} onClick={() => void confirmar()}>
              Confirmar importação
            </button>
          )}
        </div>
      )}
    </section>
  );
}
