import { NextResponse } from "next/server";
import { autorizarSuperadmin, paginar, resposta } from "@/lib/superadmin-server";
import { acumularPedidos, mesSaoPaulo, metricasVazias, validarEmpresa, Metricas, PedidoResumo } from "@/lib/superadmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const camposEmpresa = "id,nome,slug,dominio_principal,ativo,status,plano_id,criado_em,atualizado_em,telefone,whatsapp,endereco,cidade,estado,cep";

export async function GET(req: Request) {
  try {
    const access = await autorizarSuperadmin(req);
    if (access instanceof NextResponse) return access;
    const { db } = access;
    const atualizadoEm = new Date().toISOString(), mes = mesSaoPaulo(new Date(atualizadoEm));
    const metricas = metricasVazias(), porEmpresa: Record<string, Metricas> = {};
    const [empresas, planos, modulos, empresaModulos, planoModulos, credenciais, integracoes, clientes] = await Promise.all([
      paginar((a, b) => db.from("empresas").select(camposEmpresa).order("id").range(a, b)),
      paginar((a, b) => db.from("planos").select("id,nome,descricao,ativo").order("id").range(a, b)),
      paginar((a, b) => db.from("modulos").select("id,chave,nome,descricao").eq("ativo", true).order("id").range(a, b)),
      paginar((a, b) => db.from("empresa_modulos").select("empresa_id,modulo_id,ativo").order("empresa_id").order("modulo_id").range(a, b)),
      paginar((a, b) => db.from("plano_modulos").select("plano_id,modulo_id,ativo").order("plano_id").order("modulo_id").range(a, b)),
      // Credential values and integration configuration are never selected or returned.
      paginar((a, b) => db.from("integracoes_credenciais").select("empresa_id,provedor,ambiente,atualizado_em").order("id").range(a, b)),
      paginar((a, b) => db.from("integracoes_empresa").select("empresa_id,provedor,ativo,atualizado_em").order("id").range(a, b)),
      db.from("clientes").select("id", { count: "exact", head: true }).lte("criado_em", atualizadoEm),
      paginar<PedidoResumo>((a, b) => db.from("pedidos").select("empresa_id,valor_total,status_pedido,criado_em").lte("criado_em", atualizadoEm).order("id").range(a, b), rows => acumularPedidos(rows, mes, metricas, porEmpresa)),
    ]);
    if (clientes.error || clientes.count === null) throw new Error("Não foi possível contar os clientes.");
    empresas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    planos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    modulos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return resposta({ empresas, planos, modulos, empresaModulos, planoModulos, credenciais, integracoes, metricas, porEmpresa, clientes: clientes.count, atualizadoEm, mes });
  } catch (error) {
    console.error("superadmin_dashboard_error", error);
    return resposta({ error: "Não foi possível carregar o painel completo. Tente novamente." }, 500);
  }
}

async function salvar(req: Request, criar: boolean) {
  try {
    const access = await autorizarSuperadmin(req);
    if (access instanceof NextResponse) return access;
    let input: Record<string, unknown>, dados: ReturnType<typeof validarEmpresa>;
    try { input = await req.json(); dados = validarEmpresa(input); }
    catch (error) { return resposta({ error: error instanceof Error ? error.message : "Dados inválidos." }, 400); }
    const { db } = access;
    if (!criar && (typeof input.id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(input.id) || typeof input.atualizado_em !== "string" || !Number.isFinite(Date.parse(input.atualizado_em)))) {
      return resposta({ error: "Empresa ou versão inválida. Atualize o painel." }, 400);
    }
    const payload = { ...dados, atualizado_em: new Date().toISOString() };
    const result = criar
      ? await db.from("empresas").insert(payload).select(camposEmpresa).single()
      : await db.from("empresas").update(payload).eq("id", input.id).eq("atualizado_em", input.atualizado_em).select(camposEmpresa).maybeSingle();
    if (result.error?.code === "23505") return resposta({ error: "Já existe uma empresa com esse domínio ou identificador." }, 409);
    if (result.error) { console.error("superadmin_empresa_error", result.error); return resposta({ error: "Não foi possível salvar a empresa." }, 500); }
    if (!result.data) return resposta({ error: "A empresa foi alterada ou removida. Atualize o painel antes de salvar." }, 409);
    return resposta({ empresa: result.data }, criar ? 201 : 200);
  } catch (error) {
    console.error("superadmin_save_error", error);
    return resposta({ error: "Não foi possível salvar a empresa." }, 500);
  }
}
export async function POST(req: Request) { return salvar(req, true); }
export async function PATCH(req: Request) { return salvar(req, false); }
