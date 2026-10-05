import { NextResponse } from "next/server";
import { autorizarSuperadmin, paginar, resposta } from "@/lib/superadmin-server";
import { validarComercial } from "@/lib/superadmin-comercial";
export const dynamic = "force-dynamic";
const indisponivel = () => resposta({ error: "A estrutura de planos e assinaturas ainda precisa ser instalada no banco. O dashboard continua disponível." }, 503);
export async function GET(req: Request) {
  try {
    const access = await autorizarSuperadmin(req); if (access instanceof NextResponse) return access;
    const { db } = access;
    const [planos, modulos, planoModulos, assinaturas, historico] = await Promise.all([
      paginar((a,b) => db.from("planos").select("id,nome,descricao,ativo,preco_mensal,dias_teste,versao").order("id").range(a,b)),
      paginar((a,b) => db.from("modulos").select("id,chave,nome,descricao").eq("ativo",true).order("id").range(a,b)),
      paginar((a,b) => db.from("plano_modulos").select("plano_id,modulo_id,ativo").order("plano_id").order("modulo_id").range(a,b)),
      paginar((a,b) => db.from("assinaturas_empresa").select("empresa_id,plano_id,nome_plano_snapshot,valor_mensal,status,inicio,fim_teste,vencimento,notas,versao,atualizado_em").order("empresa_id").range(a,b)),
      db.from("historico_comercial").select("id,entidade,entidade_id,empresa_id,criado_em,antes,depois").order("criado_em",{ascending:false}).order("id").limit(100),
    ]);
    if (historico.error) return indisponivel();
    planos.sort((a,b) => a.nome.localeCompare(b.nome,"pt-BR"));
    return resposta({planos,modulos,planoModulos,assinaturas,historico:historico.data});
  } catch (error) { console.error("superadmin_comercial_read",error); return indisponivel(); }
}
export async function POST(req: Request) {
  try {
    const access = await autorizarSuperadmin(req); if (access instanceof NextResponse) return access;
    let input: ReturnType<typeof validarComercial>;
    try { input=validarComercial(await req.json()); } catch(error) { return resposta({error:error instanceof Error?error.message:"Dados inválidos."},400); }
    const result=await access.db.rpc("superadmin_salvar_comercial",{p_acao:input.acao,p_dados:input.dados,p_autor:access.userId});
    if (result.error) {
      if (["PGRST202","PGRST205","42P01","42703"].includes(result.error.code)) return indisponivel();
      if (result.error.code === "42501") return resposta({error:"Acesso negado."},403);
      if (["40001","23505"].includes(result.error.code)) return resposta({error:result.error.message},409);
      if (["P0001","23514","22P02","22007","23502"].includes(result.error.code)) return resposta({error:result.error.message},400);
      console.error("superadmin_comercial_save",result.error); return resposta({error:"Não foi possível salvar. Nenhuma alteração parcial foi aplicada."},500);
    }
    return resposta({registro:result.data});
  } catch(error) { console.error("superadmin_comercial_request",error); return resposta({error:"Não foi possível salvar."},500); }
}

