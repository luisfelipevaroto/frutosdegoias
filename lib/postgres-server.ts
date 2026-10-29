import 'server-only';
import { Pool } from 'pg';

let cachedPool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (cachedPool) return cachedPool;

  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL ausente');

  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL deve usar PostgreSQL');
  }
  if (url.searchParams.get('sslmode') !== 'verify-full') {
    throw new Error('DATABASE_URL deve exigir sslmode=verify-full');
  }
  if (!url.hostname || !url.username || !url.password) {
    throw new Error('DATABASE_URL incompleta');
  }

  // O node-postgres recebe a configuracao TLS explicitamente.
  // Remover parametros SSL da URL evita sobrescrever rejectUnauthorized.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    url.searchParams.delete(key);
  }

  cachedPool = new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
    query_timeout: 18000,
    application_name: 'delivery-vercel',
  });
  return cachedPool;
}
