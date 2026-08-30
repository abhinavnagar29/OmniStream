// Runs once before the whole test suite: resets the test DB schema and
// seeds a small, deterministic content fixture so tests don't depend on
// the full ingestion pipeline having been run.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://omnistream:omnistream_dev_pw@localhost:5432/omnistream_test';

const FIXTURE_ITEMS = [
  { id: 'v_ai_1', domain: 'video', title: 'AI Explainer 1', description: 'A video about ai.', rating: 4.5, popularity: 80, topic: 'ai', tags: ['ai', 'technology'] },
  { id: 'v_ai_2', domain: 'video', title: 'AI Explainer 2', description: 'Another video about ai.', rating: 4.2, popularity: 70, topic: 'ai', tags: ['ai'] },
  { id: 'p_ai_1', domain: 'podcast', title: 'AI Podcast 1', description: 'A podcast about ai.', rating: 4.0, popularity: 60, topic: 'ai', tags: ['ai'] },
  { id: 'n_ai_1', domain: 'news', title: 'AI News 1', description: 'News about ai.', rating: 3.8, popularity: 50, topic: 'ai', tags: ['ai'] },
  { id: 'm_ai_1', domain: 'movie', title: 'AI Movie 1', description: 'A movie about ai.', rating: 4.1, popularity: 65, topic: 'ai', tags: ['ai'] },
  { id: 'v_space_1', domain: 'video', title: 'Space Explainer', description: 'A video about space rockets.', rating: 4.3, popularity: 75, topic: 'space', tags: ['space'] },
];

function zeroVector(dim = 384) {
  return `[${new Array(dim).fill(0).join(',')}]`;
}

module.exports = async function globalSetup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const schema = fs.readFileSync(path.join(__dirname, 'backend', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);

  // Clean slate for every test run (tests should be independent of prior runs)
  await pool.query('TRUNCATE recommendation_events, experiment_assignments, analytics_events, interactions, preferences, content, users RESTART IDENTITY CASCADE');

  for (const item of FIXTURE_ITEMS) {
    await pool.query(
      `INSERT INTO content (id, domain, title, description, rating, popularity, source, tags, topic, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,'test-fixture',$7,$8,$9)`,
      [item.id, item.domain, item.title, item.description, item.rating, item.popularity, item.tags, item.topic, zeroVector()]
    );
  }

  await pool.end();

  // Flush the test Redis DB too -- otherwise stale rate-limit counters or
  // cached recommendations from a previous run leak into this one.
  const Redis = require('ioredis');
  const redisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
  const redisClient = new Redis(redisUrl);
  await redisClient.flushdb();
  await redisClient.quit();
};
