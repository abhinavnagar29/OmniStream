'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'db', 'schema.sql'), 'utf8');
  console.log('[migrate] applying backend/db/schema.sql ...');
  await pool.query(sql);
  console.log('[migrate] done.');
  await pool.end();
}

run().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
