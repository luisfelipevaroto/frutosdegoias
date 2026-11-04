import { NextResponse } from 'next/server';
import { autorizarErp, erpError, erpNoStore } from '@/lib/erp-api-auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const auth = await autorizarErp(req);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ ok: true, api: 'erp', version: 'v1' }, { headers: erpNoStore });
  } catch {
    return erpError(503, 'Servico temporariamente indisponivel');
  }
}
