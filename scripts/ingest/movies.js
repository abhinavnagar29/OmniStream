'use strict';

/**
 * Real-data ingestion: movies domain.
 *
 * Source: a public TMDB (The Movie Database) snapshot -- ~4,800 real movies
 * with real titles, overviews, genres, cast/keyword metadata, popularity and
 * vote data. This replaces the procedurally-generated `movie` items that
 * used to come from backend/data/content.js.
 *
 * In a deployed environment with unrestricted internet access, swap the CSV
 * read below for a live call to the TMDB API (see fetchFromTmdbApi() stub at
 * the bottom -- same normalization logic, different source). This script
 * reads a pre-fetched CSV snapshot because the sandbox this was built in has
 * network access restricted to package registries, not general APIs.
 *
 * Usage: node scripts/ingest/movies.js [--limit=1500]
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { embedText } = require('../../backend/services/embeddingService');
const contentRepo = require('../../backend/db/contentRepo');

const CSV_PATH = path.join(__dirname, '..', '..', 'backend', 'data', 'seed', 'tmdb_5000_movies.csv');

const GENRE_TO_TOPIC = {
  'Science Fiction': 'space',
  Action: 'sports', // closest existing topic bucket (energetic/exciting)
  Adventure: 'space',
  Fantasy: 'space',
  Documentary: 'ai',
  History: 'finance',
  War: 'finance',
  Drama: 'wellness',
  Romance: 'wellness',
  Family: 'wellness',
  Animation: 'wellness',
  Comedy: 'wellness',
  Thriller: 'startups',
  Crime: 'startups',
  Mystery: 'startups',
  Horror: 'startups',
  Music: 'wellness',
  Western: 'sports',
};

function safeJsonParse(raw) {
  if (!raw) return [];
  try {
    // TMDB CSV stores python-style JSON with double-double-quotes from CSV escaping;
    // csv-parse already unescapes the outer CSV quoting, so this is normal JSON.
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function pickTopic(genreNames) {
  for (const g of genreNames) {
    if (GENRE_TO_TOPIC[g]) return GENRE_TO_TOPIC[g];
  }
  return 'ai';
}

function formatRuntime(minutes) {
  const m = Number(minutes);
  if (!m || Number.isNaN(m)) return null;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return h > 0 ? `${h}:${String(rem).padStart(2, '0')}:00` : `${rem} min`;
}

function normalizeRow(row) {
  const id = `movie_${row.id}`;
  const genres = safeJsonParse(row.genres).map((g) => g.name);
  const keywords = safeJsonParse(row.keywords).map((k) => k.name).slice(0, 8);
  const title = row.title || row.original_title;
  const overview = (row.overview || '').trim();

  if (!title || !overview || overview.length < 20) return null; // skip low-quality rows

  const voteAverage = Number(row.vote_average) || 0; // 0..10
  const rating = Math.round((voteAverage / 2) * 10) / 10; // -> 0..5

  const popularityRaw = Number(row.popularity) || 0; // TMDB's own unbounded popularity score
  // squashing function keeps outliers from dominating; TMDB popularity is
  // long-tailed (most items 0-60, a handful 200+)
  const popularity = Math.round(100 * (popularityRaw / (popularityRaw + 40)));

  const releaseDate = row.release_date ? new Date(row.release_date) : null;
  const createdAt = releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate.toISOString() : new Date().toISOString();

  const tags = Array.from(new Set([...genres.map((g) => g.toLowerCase()), ...keywords.map((k) => k.toLowerCase())])).slice(0, 12);

  return {
    id,
    domain: 'movie',
    title,
    description: overview,
    thumbnail: `https://picsum.photos/seed/${encodeURIComponent(id)}/600/400.jpg`, // no TMDB image API access in this sandbox
    url: row.homepage || null,
    duration: formatRuntime(row.runtime),
    rating,
    popularity,
    source: 'tmdb',
    tags,
    topic: pickTopic(genres),
    mood: voteAverage >= 7 ? 'acclaimed' : voteAverage >= 5 ? 'mixed' : 'niche',
    intent: 'entertain',
    format: 'feature',
    language: row.original_language || 'en',
    createdAt,
    _embedInput: `${title}. ${overview} Genres: ${genres.join(', ')}.`,
  };
}

async function run({ limit = 1500 } = {}) {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Seed file not found at ${CSV_PATH}. Fetch it first (see README: data ingestion).`);
    process.exit(1);
  }

  console.log(`[ingest:movies] reading ${CSV_PATH}`);
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_quotes: true });
  console.log(`[ingest:movies] parsed ${records.length} raw rows`);

  const normalized = records
    .map(normalizeRow)
    .filter(Boolean)
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);

  console.log(`[ingest:movies] normalized ${normalized.length} usable movies (top ${limit} by popularity)`);

  let done = 0;
  const start = Date.now();
  for (const item of normalized) {
    const embedding = await embedText(item._embedInput);
    delete item._embedInput;
    item.embedding = Array.from(embedding);
    await contentRepo.upsertContent(item);
    done += 1;
    if (done % 250 === 0) {
      console.log(`[ingest:movies] ${done}/${normalized.length} embedded+upserted (${Date.now() - start}ms elapsed)`);
    }
  }

  console.log(`[ingest:movies] done. ${done} movies ingested in ${Date.now() - start}ms.`);
  return done;
}

// Stub showing what a live-API version would look like -- not called in this
// sandbox because api.themoviedb.org is not a reachable domain here.
// eslint-disable-next-line no-unused-vars
async function fetchFromTmdbApi(apiKey, pages = 20) {
  const axios = require('axios');
  const all = [];
  for (let page = 1; page <= pages; page += 1) {
    const { data } = await axios.get('https://api.themoviedb.org/3/movie/popular', {
      params: { api_key: apiKey, page },
    });
    all.push(...data.results);
  }
  return all; // would then be mapped through the same normalizeRow-style logic
}

if (require.main === module) {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 1500;
  run({ limit })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ingest:movies] failed', err);
      process.exit(1);
    });
}

module.exports = { run, normalizeRow };
