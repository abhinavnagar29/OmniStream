'use strict';

/**
 * Stage 1 -- Candidate Generation.
 *
 * Pulls a broad, cheap pool of candidates from several independent sources,
 * each cabable of finding relevant items the others would miss:
 *
 *   - semantic:   ANN vector search (pgvector/HNSW) around a "user embedding"
 *                 built from recently-liked/opened items' precomputed embeddings
 *   - cf:         collaborative filtering ("users like you liked X") --
 *                 see ml/train_cf.py + backend/services/cfService.js.
 *                 Falls back to no-op for users outside the CF training set
 *                 (cold-start users), which is expected and handled.
 *   - trending:   domain-agnostic popularity, always included as a safety net
 *   - cold_start: onboarding-preference-based popularity, used when a user
 *                 has no interaction history at all
 *
 * Candidate counts per source are configurable via env vars so they're never
 * hardcoded magic numbers scattered through the codebase (Phase 8 requirement).
 */

const contentRepo = require('../db/contentRepo');
const interactionRepo = require('../db/interactionRepo');
const { embedText, EMBEDDING_DIM } = require('./embeddingService');
const cfService = require('./cfService');

const N_SEMANTIC = Number(process.env.CANDIDATES_SEMANTIC || 200);
const N_CF = Number(process.env.CANDIDATES_CF || 200);
const N_TRENDING = Number(process.env.CANDIDATES_TRENDING || 100);
const N_COLD_START = Number(process.env.CANDIDATES_COLD_START || 150);

/**
 * A "user embedding" built as a recency+weight-weighted average of the
 * embeddings of items the user has positively interacted with. This is the
 * standard, cheap way to get a query vector for ANN retrieval without
 * training a dedicated user-tower model (see Phase 26 for that upgrade path).
 */
async function buildUserEmbedding(interactionRows) {
  const positive = interactionRows.filter((r) => r.weight > 0);
  if (!positive.length) return null;

  const ids = positive.map((r) => r.content_id);
  const items = await contentRepo.getByIds(ids);
  const byId = new Map(items.map((i) => [i.id, i]));

  const acc = new Float64Array(EMBEDDING_DIM);
  let totalWeight = 0;

  for (const row of positive) {
    const item = byId.get(row.content_id);
    if (!item || !item.embedding) continue;
    const vec = parseVectorLiteral(item.embedding);
    const ageDays = Math.max(0, (Date.now() - new Date(row.created_at).getTime()) / 86_400_000);
    const recency = 0.5 ** (ageDays / 14);
    const w = row.weight * recency;
    for (let i = 0; i < EMBEDDING_DIM; i += 1) acc[i] += vec[i] * w;
    totalWeight += Math.abs(w);
  }

  if (!totalWeight) return null;
  return Array.from(acc, (v) => v / totalWeight);
}

function parseVectorLiteral(pgVector) {
  // pg returns pgvector columns as a string like "[0.1,0.2,...]"
  if (Array.isArray(pgVector)) return pgVector;
  return String(pgVector).replace(/[[\]]/g, '').split(',').map(Number);
}

async function coldStartQueryEmbedding(preferences) {
  const interestedTopics = [];
  for (const [domain, prefs] of Object.entries(preferences || {})) {
    if (prefs?.interested || prefs?.neutral) {
      const cats = String(prefs.categories || '').split(',').filter(Boolean);
      interestedTopics.push(domain, ...cats);
    }
  }
  if (!interestedTopics.length) return null;
  return Array.from(await embedText(`Interested in: ${interestedTopics.join(', ')}`));
}

/**
 * @returns {Array<{item, candidateSource, sourceScore}>}
 */
async function generateCandidates({ userId, domain, preferences, interactionRows }) {
  const candidates = new Map(); // contentId -> {item, sources: Set, bestSourceScore}
  const interactedIds = interactionRows.map((r) => r.content_id);

  const addAll = (rows, source, scoreKey) => {
    for (const item of rows) {
      const existing = candidates.get(item.id);
      const score = scoreKey ? item[scoreKey] ?? 0 : 0;
      if (existing) {
        existing.sources.add(source);
        existing.bestSourceScore = Math.max(existing.bestSourceScore, score);
      } else {
        candidates.set(item.id, { item, sources: new Set([source]), bestSourceScore: score });
      }
    }
  };

  const isColdStart = interactionRows.length === 0;

  if (!isColdStart) {
    // ---- Semantic ANN retrieval ----
    const userVec = await buildUserEmbedding(interactionRows);
    if (userVec) {
      const semantic = await contentRepo.findSimilarByVector(userVec, {
        limit: N_SEMANTIC,
        excludeIds: interactedIds,
        domain: domain || null,
      });
      addAll(semantic, 'semantic', 'similarity');
    }

    // ---- Collaborative filtering ----
    const cf = await cfService.getCfCandidates(userId, { limit: N_CF, domain });
    addAll(cf, 'cf', 'cfScore');
  } else {
    // ---- Cold start: no interaction history yet ----
    const coldVec = await coldStartQueryEmbedding(preferences);
    if (coldVec) {
      const semantic = await contentRepo.findSimilarByVector(coldVec, {
        limit: N_COLD_START,
        domain: domain || null,
      });
      addAll(semantic, 'cold_start', 'similarity');
    }
    const popular = await contentRepo.trending({ limit: N_COLD_START, domain: domain || null });
    addAll(popular, 'cold_start', 'popularity');
  }

  // ---- Trending: always included as a recall safety net ----
  const trending = await contentRepo.trending({ limit: N_TRENDING, domain: domain || null });
  addAll(trending, 'trending', 'popularity');

  return Array.from(candidates.values()).map((c) => ({
    item: c.item,
    candidateSources: Array.from(c.sources),
    sourceScore: c.bestSourceScore,
  }));
}

module.exports = { generateCandidates, buildUserEmbedding, parseVectorLiteral };
