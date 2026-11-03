import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const erpNoStore = { 'Cache-Control': 'private, no-store', 'Vary': 'Authorization' };
const tokenPattern = /^erp_[a-f0-9]{64}$/;
export function erpError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status, headers: erpNoStore });
}
export function erpServiceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('ERP_SERVICE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function autorizarErp(req: Request) {
  const raw = req.headers.get('authorization') ?? '';
  const token = /^Bearer (\S+)$/i.exec(raw)?.[1];
  if (!token || !tokenPattern.test(token)) return erpError(401, 'Credencial invalida');
  const db = erpServiceDb();
  const hash = createHash('sha256').update(token, 'utf8').digest('hex');
  const { data, error } = await db.from('erp_api_chaves')
    .select('id,empresa_id,chave_hash,empresas!inner(ativo)')
    .eq('chave_hash', hash).eq('ativo', true).is('revogado_em', null).maybeSingle();
  if (error) throw error;
  const stored = data?.chave_hash ?? '';
  const equal = stored.length === hash.length &&
    timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(hash, 'hex'));
  const company = data?.empresas as unknown as { ativo?: boolean } | null;
  if (!equal || !company?.ativo) return erpError(401, 'Credencial invalida');
  const { data: permitido, error: limiteError } = await db.rpc('erp_api_consumir_limite', { p_chave_id: data!.id });
  if (limiteError) throw limiteError;
  if (permitido !== true) {
    return NextResponse.json({ error: 'Limite de 60 requisicoes por minuto excedido' }, {
      status: 429,
      headers: { ...erpNoStore, 'Retry-After': '60' }
    });
  }
  return { db, empresaId: data!.empresa_id as string, chaveId: data!.id as string };
}
