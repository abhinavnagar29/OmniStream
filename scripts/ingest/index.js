'use strict';

require('dotenv').config();
const movies = require('./movies');
const synthetic = require('./synthetic');
const contentRepo = require('../../backend/db/contentRepo');

async function run() {
  const before = await contentRepo.count();
  console.log(`[ingest] content table has ${before} rows before ingestion`);

  const movieCount = await movies.run({ limit: Number(process.env.INGEST_MOVIE_LIMIT || 1500) });
  const syntheticCount = await synthetic.run();

  const after = await contentRepo.count();
  console.log(`[ingest] complete. movies=${movieCount} synthetic=${syntheticCount} total_rows_now=${after}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ingest] failed', err);
    process.exit(1);
  });
