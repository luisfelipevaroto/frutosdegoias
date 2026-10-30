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

  // A CA publica e fornecida via variavel de ambiente, nunca por arquivo da VPS.
  // O Node valida a cadeia de certificados e o hostname do PgBouncer.
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (!ca || !ca.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('DATABASE_CA_CERT ausente ou invalido');
  }

  // SSL e configurado explicitamente para nao ser sobrescrito pela connection string.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    url.searchParams.delete(key);
  }

  cachedPool = new Pool({
    connectionString: url.toString(),
    ssl: { ca, rejectUnauthorized: true, servername: url.hostname },
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 15000,
    query_timeout: 18000,
    application_name: 'delivery-vercel',
  });
  return cachedPool;
}
