import 'server-only';
import { Pool } from 'pg';

let cachedPool: Pool | undefined;

export function getPostgresPool(): Pool {
  if (!cachedPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL ausente');
    cachedPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: true },
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
    });
  }
  return cachedPool;
}
