'use strict';

/**
 * Measures brute-force cosine similarity search vs. pgvector HNSW ANN
 * search, at multiple synthetic catalog sizes, in an isolated table so it
 * never touches the real `content` table.
 *
 * Methodology:
 *   1. Generate N random unit vectors (384-dim, matching the real embedding
 *      dimension) directly in Postgres (pgvector's own random generation is
 *      avoided in favor of explicit control over the distribution).
 *   2. Run 50 nearest-neighbor queries with NO index (forces a sequential
 *      scan -- true brute force) and record p50/p95 latency.
 *   3. Build an HNSW index on the same data, run the same 50 queries, and
 *      record p50/p95 latency again.
 *   4. Drop the table, move to the next size.
 *
 * Random vectors (rather than real embeddings) are used deliberately: this
 * benchmark measures the SEARCH ALGORITHM's scaling behavior, which does
 * not depend on whether the vectors are semantically meaningful -- it's a
 * property of the index structure and catalog size, not the data's meaning.
 *
 * Run: node scripts/benchmark/annBenchmark.js [--sizes=10000,50000,100000]
 * Writes: ml/ann_benchmark_results.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DIM = 384;
const N_QUERIES = 50;
const TABLE = 'bench_vectors';

function percentile(sortedArr, p) {
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

function randomUnitVector(dim) {
  const v = new Float32Array(dim);
  let norm = 0;
  for (let i = 0; i < dim; i += 1) {
    v[i] = Math.random() * 2 - 1;
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i += 1) v[i] /= norm;
  return v;
}

function toVectorLiteral(v) {
  return `[${Array.from(v).join(',')}]`;
}

async function timeQueries(pool, queryVectors) {
  const timings = [];
  for (const vec of queryVectors) {
    const t0 = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    await pool.query(`SELECT id FROM ${TABLE} ORDER BY embedding <=> $1 LIMIT 10`, [toVectorLiteral(vec)]);
    const t1 = process.hrtime.bigint();
    timings.push(Number(t1 - t0) / 1e6); // ms
  }
  timings.sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(timings, 50) * 100) / 100,
    p95: Math.round(percentile(timings, 95) * 100) / 100,
    max: Math.round(timings[timings.length - 1] * 100) / 100,
    mean: Math.round((timings.reduce((s, x) => s + x, 0) / timings.length) * 100) / 100,
  };
}

async function benchmarkSize(pool, size) {
  console.log(`\n[benchmark] === size=${size} ===`);
  await pool.query(`DROP TABLE IF EXISTS ${TABLE}`);
  await pool.query(`CREATE TABLE ${TABLE} (id SERIAL PRIMARY KEY, embedding vector(${DIM}))`);

  console.log(`[benchmark] inserting ${size} random vectors...`);
  const t0 = Date.now();
  const BATCH = 500;
  for (let i = 0; i < size; i += BATCH) {
    const n = Math.min(BATCH, size - i);
    const values = [];
    const params = [];
    for (let j = 0; j < n; j += 1) {
      values.push(`($${j + 1})`);
      params.push(toVectorLiteral(randomUnitVector(DIM)));
    }
    // eslint-disable-next-line no-await-in-loop
    await pool.query(`INSERT INTO ${TABLE} (embedding) VALUES ${values.join(',')}`, params);
  }
  const insertMs = Date.now() - t0;
  console.log(`[benchmark] inserted in ${insertMs}ms`);

  const queryVectors = Array.from({ length: N_QUERIES }, () => randomUnitVector(DIM));

  console.log('[benchmark] running brute-force (no index) queries...');
  const bruteForce = await timeQueries(pool, queryVectors);
  console.log(`[benchmark] brute-force: p50=${bruteForce.p50}ms p95=${bruteForce.p95}ms`);

  console.log('[benchmark] building HNSW index...');
  const tIdx0 = Date.now();
  await pool.query(`CREATE INDEX ON ${TABLE} USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)`);
  const indexBuildMs = Date.now() - tIdx0;
  console.log(`[benchmark] index built in ${indexBuildMs}ms`);

  console.log('[benchmark] running HNSW-indexed queries...');
  const hnsw = await timeQueries(pool, queryVectors);
  console.log(`[benchmark] HNSW: p50=${hnsw.p50}ms p95=${hnsw.p95}ms`);

  await pool.query(`DROP TABLE ${TABLE}`);

  return {
    size,
    insertMs,
    indexBuildMs,
    bruteForce,
    hnsw,
    speedupP50: Math.round((bruteForce.p50 / Math.max(hnsw.p50, 0.01)) * 100) / 100,
    speedupP95: Math.round((bruteForce.p95 / Math.max(hnsw.p95, 0.01)) * 100) / 100,
  };
}

async function main() {
  const sizesArg = process.argv.find((a) => a.startsWith('--sizes='));
  const sizes = sizesArg
    ? sizesArg.split('=')[1].split(',').map(Number)
    : [10000, 50000, 100000];

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const results = [];
  for (const size of sizes) {
    // eslint-disable-next-line no-await-in-loop
    const r = await benchmarkSize(pool, size);
    results.push(r);
  }
  await pool.end();

  const out = { generatedAt: new Date().toISOString(), dim: DIM, nQueries: N_QUERIES, results };
  const outPath = path.join(__dirname, '..', '..', 'ml', 'ann_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  console.log(`\n[benchmark] wrote ${outPath}\n`);
  console.log('| Catalog size | Brute-force p50 | Brute-force p95 | HNSW p50 | HNSW p95 | Speedup (p50) |');
  console.log('|---|---|---|---|---|---|');
  for (const r of results) {
    console.log(`| ${r.size.toLocaleString()} | ${r.bruteForce.p50}ms | ${r.bruteForce.p95}ms | ${r.hnsw.p50}ms | ${r.hnsw.p95}ms | ${r.speedupP50}x |`);
  }
}

main().catch((err) => {
  console.error('[benchmark] failed', err);
  process.exit(1);
});
