import { NextResponse } from 'next/server';
import { erpNoStore } from '@/lib/erp-api-auth';

export const erpUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
export type Cursor = { criado_em: string; id: string };
export function decodeCursor(raw: string | null): Cursor | null {
  if (!raw || raw.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(raw)) return null;
  try {
    const obj: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!obj || typeof obj !== 'object') return null;
    const x = obj as Record<string, unknown>;
    if (typeof x.criado_em !== 'string' || !timestamp.test(x.criado_em) ||
        Number.isNaN(Date.parse(x.criado_em)) || typeof x.id !== 'string' || !erpUuid.test(x.id)) return null;
    return { criado_em: x.criado_em, id: x.id };
  } catch { return null; }
}
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}
export function erpJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: erpNoStore });
}
