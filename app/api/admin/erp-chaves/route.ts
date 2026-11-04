import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { autorizarEmpresa } from '@/lib/admin-server';
import { erpError, erpNoStore } from '@/lib/erp-api-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function admin(req: Request) {
  const empresaId = new URL(req.url).searchParams.get('empresa_id') ?? '';
  if (!uuid.test(empresaId)) return erpError(400, 'Empresa invalida');
  const access = await autorizarEmpresa(req, empresaId);
  if (access instanceof NextResponse) return access;
  return { ...access, empresaId };
}
export async function GET(req: Request) {
  try {
    const access = await admin(req);
    if (access instanceof NextResponse) return access;
    const { data, error } = await access.db.from('erp_api_chaves')
      .select('id,nome,prefixo,ativo,criado_em,revogado_em')
      .eq('empresa_id', access.empresaId).order('criado_em', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data }, { headers: erpNoStore });
  } catch { return erpError(503, 'Servico temporariamente indisponivel'); }
}
export async function POST(req: Request) {
  try {
    const access = await admin(req);
    if (access instanceof NextResponse) return access;
    const body = await req.json().catch(() => null);
    const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
    if (!nome || nome.length > 100) return erpError(400, 'Nome invalido');
    const { count, error: countError } = await access.db.from('erp_api_chaves')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', access.empresaId).eq('ativo', true).is('revogado_em', null);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return erpError(409, 'Limite de chaves ativas atingido');
    const token = 'erp_' + randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const { data, error } = await access.db.from('erp_api_chaves')
      .insert({ empresa_id: access.empresaId, nome, prefixo: token.slice(0, 12), chave_hash: hash })
      .select('id,nome,prefixo,criado_em').single();
    if (error) throw error;
    // O token so e exibido na criacao. Nao registrar em logs nem armazenar no navegador.
    return NextResponse.json({ ...data, token }, { status: 201, headers: erpNoStore });
  } catch { return erpError(503, 'Servico temporariamente indisponivel'); }
}
export async function DELETE(req: Request) {
  try {
    const access = await admin(req);
    if (access instanceof NextResponse) return access;
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (!uuid.test(id)) return erpError(400, 'Chave invalida');
    const { data, error } = await access.db.from('erp_api_chaves')
      .update({ ativo: false, revogado_em: new Date().toISOString() })
      .eq('empresa_id', access.empresaId).eq('id', id)
      .select('id').maybeSingle();
    if (error) throw error;
    if (!data) return erpError(404, 'Chave nao encontrada');
    return NextResponse.json({ ok: true }, { headers: erpNoStore });
  } catch { return erpError(503, 'Servico temporariamente indisponivel'); }
}
