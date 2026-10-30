import 'server-only';
import type { NextRequest } from 'next/server';

/**
 * Domínio resolvido exclusivamente no servidor.
 * Em Preview, o domínio é fixado pela configuração da implantação,
 * e não por query params, headers enviados pelo navegador ou localStorage.
 */
export function resolveStoreDomain(request: NextRequest): string | null {
  const preview = process.env.VERCEL_ENV === 'preview';
  const configured = preview ? process.env.DELIVERY_PREVIEW_DOMAIN : undefined;
  const host = configured ?? request.nextUrl.hostname;
  const normalized = host.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized || normalized === 'localhost' || normalized === '127.0.0.1') return null;
  if (!/^[a-z0-9.-]+$/.test(normalized) || normalized.includes('..')) return null;
  return normalized;
}
