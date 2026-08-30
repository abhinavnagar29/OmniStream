'use strict';

/**
 * Generates SIMULATED users and interactions for CF training + offline
 * evaluation. This project has no real user base yet, so there is no real
 * interaction log to train a collaborative-filtering model on or to
 * evaluate the recommender against. This script produces a synthetic-but-
 * structured one instead:
 *
 *   - Each simulated user gets 1-2 genre/topic "taste profiles"
 *     (e.g. leans toward sci-fi + space, or drama + wellness).
 *   - Interactions are sampled from the REAL TMDB movie catalog, weighted
 *     by how well each movie's genres/topic match the user's taste, plus a
 *     popularity prior (popular items get sampled more, like real traffic).
 *   - Event type (impression/open/like/skip) is drawn probabilistically:
 *     a strong taste match is likely to become an `open` and sometimes a
 *     `like`; a poor match is likely to end at `impression` or `skip`.
 *   - Timestamps are spread over the last 90 days so recency decay in
 *     userModelService has something real to decay.
 *
 * This is a documented, standard technique for bootstrapping a recommender
 * before real traffic exists -- but it is NOT real user behavior, and
 * every table this touches is queried separately from anything a real
 * signed-up user does (users.is_simulated = true).
 *
 * Usage: node scripts/simulate/generateInteractions.js [--users=300] [--interactionsPerUser=40]
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../../backend/db/pool');

const TASTE_PROFILES = [
  { name: 'scifi_space', topics: ['space'], genreHints: ['science fiction', 'adventure', 'fantasy'] },
  { name: 'drama_wellness', topics: ['wellness'], genreHints: ['drama', 'romance', 'family'] },
  { name: 'thriller_startup', topics: ['startups'], genreHints: ['thriller', 'crime', 'mystery'] },
  { name: 'documentary_ai', topics: ['ai'], genreHints: ['documentary'] },
  { name: 'action_sports', topics: ['sports'], genreHints: ['action', 'western'] },
  { name: 'finance_history', topics: ['finance'], genreHints: ['history', 'war'] },
];

function pickN(arr, n) {
  const copy = arr.slice();
  const out = [];
  for (let i = 0; i < n && copy.length; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function matchScore(item, profile) {
  const tags = (item.tags || []).map((t) => t.toLowerCase());
  const genreHitCount = profile.genreHints.filter((g) => tags.includes(g)).length;
  const topicHit = profile.topics.includes(item.topic) ? 1 : 0;
  return genreHitCount * 0.6 + topicHit * 1.0;
}

async function ensureSimulatedUsers(n) {
  const passwordHash = await bcrypt.hash('simulated-user-not-a-real-login', 4);
  const ids = [];
  for (let i = 0; i < n; i += 1) {
    const email = `sim_user_${String(i).padStart(4, '0')}@omnistream.local`;
    const profiles = pickN(TASTE_PROFILES, 1 + (Math.random() < 0.35 ? 1 : 0));
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, is_simulated)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (email) DO UPDATE SET display_name = $3
       RETURNING id`,
      [email, passwordHash, `Simulated User ${i} (${profiles.map((p) => p.name).join('+')})`]
    );
    ids.push({ id: rows[0].id, profiles });
  }
  return ids;
}

async function loadCatalog() {
  const { rows } = await query(`SELECT id, domain, topic, tags, popularity FROM content WHERE domain = 'movie'`);
  return rows;
}

function randomTimestampWithinDays(days) {
  const now = Date.now();
  const past = now - Math.random() * days * 86_400_000;
  return new Date(past);
}

async function simulateForUser(user, catalog, interactionsPerUser) {
  // Weight every catalog item by taste match + popularity prior, then sample without replacement.
  const weighted = catalog.map((item) => {
    const taste = Math.max(...user.profiles.map((p) => matchScore(item, p)), 0);
    const popularityPrior = (item.popularity || 10) / 100;
    return { item, weight: 0.15 + taste * 1.2 + popularityPrior * 0.4, taste };
  });

  const total = weighted.reduce((s, w) => s + w.weight, 0);
  const sampleSize = Math.min(interactionsPerUser, catalog.length);
  const picked = [];
  const pool = weighted.slice();
  let remainingTotal = total;

  for (let i = 0; i < sampleSize; i += 1) {
    let r = Math.random() * remainingTotal;
    let idx = -1;
    for (let j = 0; j < pool.length; j += 1) {
      r -= pool[j].weight;
      if (r <= 0) { idx = j; break; }
    }
    if (idx === -1) idx = pool.length - 1;
    const [chosen] = pool.splice(idx, 1);
    remainingTotal -= chosen.weight;
    picked.push(chosen);
  }

  const rows = [];
  for (const { item, taste } of picked) {
    const createdAt = randomTimestampWithinDays(90);
    // Always an impression
    rows.push({ userId: user.id, contentId: item.id, eventType: 'impression', createdAt });

    const openProb = Math.min(0.9, 0.15 + taste * 0.35);
    if (Math.random() < openProb) {
      const openedAt = new Date(createdAt.getTime() + 1000);
      rows.push({ userId: user.id, contentId: item.id, eventType: 'open', createdAt: openedAt });

      const likeProb = Math.min(0.85, taste * 0.4);
      if (Math.random() < likeProb) {
        rows.push({ userId: user.id, contentId: item.id, eventType: 'like', createdAt: new Date(openedAt.getTime() + 2000) });
      } else if (Math.random() < 0.15) {
        rows.push({ userId: user.id, contentId: item.id, eventType: 'skip', createdAt: new Date(openedAt.getTime() + 2000) });
      }
    } else if (Math.random() < 0.3) {
      rows.push({ userId: user.id, contentId: item.id, eventType: 'skip', createdAt: new Date(createdAt.getTime() + 1000) });
    }
  }
  return rows;
}

const EVENT_WEIGHTS = { like: 3, unlike: -3, open: 1, skip: -2, impression: 0.05, search: 0.2 };

async function insertRows(rows) {
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    chunk.forEach((r, idx) => {
      const base = idx * 5;
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
      params.push(r.userId, r.contentId, r.eventType, EVENT_WEIGHTS[r.eventType] ?? 0, r.createdAt);
    });
    await query(
      `INSERT INTO interactions (user_id, content_id, event_type, weight, created_at) VALUES ${values.join(',')}`,
      params
    );
  }
}

async function run({ users = 300, interactionsPerUser = 40 } = {}) {
  console.log(`[simulate] creating ${users} simulated users...`);
  const simUsers = await ensureSimulatedUsers(users);

  console.log('[simulate] loading real movie catalog for sampling...');
  const catalog = await loadCatalog();
  console.log(`[simulate] catalog size: ${catalog.length}`);

  console.log(`[simulate] simulating ~${interactionsPerUser} interactions per user...`);
  let totalRows = 0;
  for (const user of simUsers) {
    const rows = await simulateForUser(user, catalog, interactionsPerUser);
    await insertRows(rows);
    totalRows += rows.length;
  }

  console.log(`[simulate] done. ${simUsers.length} simulated users, ${totalRows} interaction rows inserted.`);
}

if (require.main === module) {
  const usersArg = process.argv.find((a) => a.startsWith('--users='));
  const perUserArg = process.argv.find((a) => a.startsWith('--interactionsPerUser='));
  run({
    users: usersArg ? Number(usersArg.split('=')[1]) : 300,
    interactionsPerUser: perUserArg ? Number(perUserArg.split('=')[1]) : 40,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[simulate] failed', err);
      process.exit(1);
    });
}

module.exports = { run };
