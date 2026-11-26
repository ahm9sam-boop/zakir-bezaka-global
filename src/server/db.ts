import pg from 'pg';

// Free persistent Postgres (Neon). Set DATABASE_URL in the environment to turn it on.
export const dbEnabled = Boolean(process.env.DATABASE_URL);

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool | null {
  if (!dbEnabled) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 15000,
    });
    pool.on('error', (e) => console.error('pg pool error', e.message));
  }
  return pool;
}

export async function dbQuery(text: string, params: any[] = []) {
  const p = getPool();
  if (!p) throw new Error('db disabled');
  // Neon can suspend an idle database; the first query after a pause may need one retry.
  try {
    return await p.query(text, params);
  } catch (e: any) {
    if (/terminat|ECONNRESET|timeout|Connection/i.test(String(e?.message))) {
      await new Promise((r) => setTimeout(r, 800));
      return await p.query(text, params);
    }
    throw e;
  }
}

export async function ensureSchema() {
  if (!dbEnabled) return;
  await dbQuery(`CREATE TABLE IF NOT EXISTS zk_students (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await dbQuery(`CREATE INDEX IF NOT EXISTS zk_students_phone_idx ON zk_students (phone)`);
  await dbQuery(`CREATE TABLE IF NOT EXISTS zk_kv (k TEXT PRIMARY KEY, v JSONB NOT NULL)`);
}
