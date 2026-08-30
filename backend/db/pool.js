const { Pool } = require('pg');

// A single shared pool for the process. Connection pooling matters here:
// without it, every request would pay full TCP+auth handshake cost against
// Postgres, which dominates latency at any real concurrency.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  // Idle client errors (e.g. connection dropped) must not crash the process.
  // eslint-disable-next-line no-console
  console.error('[pg pool] unexpected error on idle client', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 200) {
    // eslint-disable-next-line no-console
    console.warn(`[pg] slow query (${ms}ms): ${text.slice(0, 120)}`);
  }
  return res;
}

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

module.exports = { pool, query, healthCheck };
