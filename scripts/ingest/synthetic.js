'use strict';

/**
 * Ingests the video / music / podcast / news domains using the project's
 * original procedural content generator (backend/data/content.js).
 *
 * These domains are NOT backed by real external data in this build --
 * unlike `movie` (see scripts/ingest/movies.js, real TMDB data), there was
 * no reachable public API/dataset for these domains inside this sandbox's
 * restricted network. Every row here is written with
 * `source: 'synthetic-generator'` so the catalog is never ambiguous about
 * what's real and what isn't -- see docs/architecture.md, "data provenance"
 * for the honest breakdown and what a production build would swap in
 * (YouTube Data API for video, Spotify Web API for music, Podcast Index API
 * for podcast, NewsAPI/GNews for news -- the ingestion pattern is identical
 * to scripts/ingest/movies.js, just a different fetcher + normalizer).
 */

const { content: generatedContent } = require('../../backend/data/content');
const { embedText } = require('../../backend/services/embeddingService');
const contentRepo = require('../../backend/db/contentRepo');

async function run() {
  const all = generatedContent;
  const nonMovie = all.filter((item) => item.domain !== 'movie');
  console.log(`[ingest:synthetic] generated ${nonMovie.length} items across domains: ${[...new Set(nonMovie.map((i) => i.domain))].join(', ')}`);

  let done = 0;
  for (const item of nonMovie) {
    const embedInput = `${item.title}. ${item.description} Tags: ${item.tags.join(', ')}.`;
    const embedding = await embedText(embedInput);
    await contentRepo.upsertContent({ ...item, source: 'synthetic-generator', embedding: Array.from(embedding) });
    done += 1;
  }
  console.log(`[ingest:synthetic] done. ${done} items ingested.`);
  return done;
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ingest:synthetic] failed', err);
      process.exit(1);
    });
}

module.exports = { run };
