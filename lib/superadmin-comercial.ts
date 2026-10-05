import type { ModuloPlano, ModuloSuperadmin } from "./superadmin";
export type PlanoComercial = { id: string; nome: string; descricao: string | null; ativo: boolean; preco_mensal: number | null; dias_teste: number; versao: number };
export type Assinatura = { empresa_id: string; plano_id: string; nome_plano_snapshot: string; valor_mensal: number; status: "trial" | "ativa" | "atrasada" | "cancelada"; inicio: string; fim_teste: string | null; vencimento: string | null; notas: string; versao: number; atualizado_em: string };
export type HistoricoComercial = { id: string; entidade: string; entidade_id: string; empresa_id: string | null; criado_em: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null };
export type DadosComerciais = { planos: PlanoComercial[]; modulos: ModuloSuperadmin[]; planoModulos: ModuloPlano[]; assinaturas: Assinatura[]; historico: HistoricoComercial[] };
export const statusAssinatura = { trial: "Em teste", ativa: "Ativa", atrasada: "Atrasada", cancelada: "Cancelada" };
export function dataSaoPaulo() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()); }
export function somarDias(data: string, dias: number) { const d = new Date(`${data}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); }
export function resumoAssinaturas(assinaturas: Assinatura[], hoje = dataSaoPaulo()) {
  return { mrr: assinaturas.filter(s => s.status === "ativa").reduce((n, s) => n + Math.round(Number(s.valor_mensal) * 100), 0) / 100,
    ativas: assinaturas.filter(s => s.status === "ativa").length, testes: assinaturas.filter(s => s.status === "trial").length,
    pendencias: assinaturas.filter(s => s.status === "atrasada" || (s.status === "ativa" && s.vencimento && s.vencimento < hoje) || (s.status === "trial" && s.fim_teste && s.fim_teste < hoje)).length };
}
export function validarComercial(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Dados inválidos.");
  const x = input as Record<string, unknown>;
  const texto = (k: string, max: number) => { if (typeof x[k] !== "string" || (x[k] as string).length > max) throw new Error(`Verifique ${k}.`); return (x[k] as string).trim(); };
  const uuid = (k: string) => { const s = texto(k, 36); if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(s)) throw new Error(`Identificador inválido: ${k}.`); return s; };
  const dinheiro = (k: string) => { const n = x[k]; if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 999999.99 || Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new Error("Informe um valor válido com até duas casas decimais."); return n; };
  const inteiro = (k: string, max = Number.MAX_SAFE_INTEGER) => { const n = x[k]; if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0 || n > max) throw new Error(`Verifique ${k}.`); return n; };
  const data = (k: string, opcional = false) => { const s = texto(k, 10); if (!s && opcional) return null; const date = new Date(`${s}T12:00:00Z`); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== s) throw new Error(`Data inválida: ${k}.`); return s; };
  if (x.acao === "salvar_plano") {
    const nome = texto("nome", 100); if (!nome) throw new Error("Informe o nome do plano.");
    if (typeof x.ativo !== "boolean" || !Array.isArray(x.modulos) || x.modulos.length > 100) throw new Error("Plano inválido.");
    const modulos = [...new Set(x.modulos.map(value => { if (typeof value !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value)) throw new Error("Módulo inválido."); return value; }))];
    return { acao: x.acao, dados: { id: x.id === null ? null : uuid("id"), nome, descricao: texto("descricao", 1000), ativo: x.ativo, preco_mensal: dinheiro("preco_mensal"), dias_teste: inteiro("dias_teste", 365), modulos, versao: inteiro("versao") } };
  }
  if (x.acao === "salvar_assinatura") {
    const status = texto("status", 20); if (!Object.hasOwn(statusAssinatura, status)) throw new Error("Status inválido.");
    const inicio = data("inicio")!, fim_teste = data("fim_teste", true), vencimento = data("vencimento", true);
    if (status === "trial" && !fim_teste) throw new Error("Informe o fim do teste.");
    if ((status === "ativa" || status === "atrasada") && !vencimento) throw new Error("Informe o vencimento.");
    if ((fim_teste && fim_teste < inicio) || (vencimento && vencimento < inicio)) throw new Error("As datas finais devem ser iguais ou posteriores ao início.");
    return { acao: x.acao, dados: { empresa_id: uuid("empresa_id"), plano_id: uuid("plano_id"), plano_versao: inteiro("plano_versao"), valor_mensal: dinheiro("valor_mensal"), status, inicio, fim_teste: fim_teste || "", vencimento: vencimento || "", notas: texto("notas", 1000), versao: inteiro("versao") } };
  }
  if (x.acao === "herdar_modulo") return { acao: x.acao, dados: { empresa_id: uuid("empresa_id"), modulo_id: uuid("modulo_id") } };
  throw new Error("Operação inválida.");
}

