'use strict';

/**
 * Stage 2 -- Ranking.
 *
 * Scores the merged candidate pool from candidateGeneration.js. The default
 * ranker is the original hand-weighted formula (rating/recency/overlap +
 * affinity + semantic + CF signal), kept as an always-available fallback.
 * If ml/models/ranker.json (a LightGBM model trained by ml/train_ranker.py)
 * exists, its prediction is blended in instead -- see loadLearnedRanker().
 *
 * Deliberately kept separate from candidate generation: ranking is where
 * "what does the user want" gets decided, retrieval is only "what's
 * plausible" -- mixing them makes both harder to reason about and to test.
 */

const { affinityForItem } = require('./userModelService');
const learnedRanker = require('./learnedRanker');

function normalizeText(s) {
  return String(s || '').toLowerCase();
}

function parseCategories(cats) {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c) => normalizeText(c)).filter(Boolean);
  return String(cats).split(',').map((c) => normalizeText(c.trim())).filter(Boolean);
}

function heuristicScore(item, { prefsForDomain, likedIds, interactionScore, affinity, semantic, cfScore }) {
  const categories = parseCategories(prefsForDomain?.categories);
  const tags = (item.tags || []).map(normalizeText);
  const overlap = categories.length
    ? tags.filter((t) => categories.includes(t)).length / Math.max(1, categories.length)
    : 0;

  const ratingScore = typeof item.rating === 'number' ? item.rating / 5 : 0.7;

  const created = item.created_at || item.createdAt;
  const ageDays = created ? Math.max(0, (Date.now() - new Date(created).getTime()) / 86_400_000) : 30;
  const recencyScore = Math.max(0, 1 - ageDays / 60);

  const interestBoost = prefsForDomain?.interested ? 0.15 : prefsForDomain?.neutral ? 0.05 : 0;
  const likedBoost = likedIds?.has(item.id) ? 0.1 : 0;
  const interactionBoost = Math.max(-0.2, Math.min(0.2, (interactionScore || 0) / 20));
  const cfBoost = typeof cfScore === 'number' ? Math.max(0, Math.min(0.25, cfScore * 0.15)) : 0;

  const base = 0.4 * ratingScore + 0.25 * recencyScore + 0.15 * overlap + interestBoost + likedBoost + interactionBoost;
  return base + affinity * 0.25 + semantic * 0.35 + cfBoost;
}

function trendingScore(item) {
  const popularity = typeof item.popularity === 'number' ? item.popularity : 0;
  const created = item.created_at || item.createdAt;
  const ageDays = created ? Math.max(0, (Date.now() - new Date(created).getTime()) / 86_400_000) : 30;
  const recencyScore = Math.max(0, 1 - ageDays / 30);
  return popularity * 0.8 + recencyScore * 0.2;
}

/**
 * @param candidates [{item, candidateSources, sourceScore}]
 * @returns ranked items with relevanceScore, trendingScore, explanation attached
 */
function rankCandidates(candidates, { profile, preferences, likedIds, interactionScores, mode }) {
  const useLearnedRanker = learnedRanker.isAvailable();

  const scored = candidates.map(({ item, candidateSources, sourceScore }) => {
    const prefsForDomain = preferences?.[item.domain] || {};
    const interactionScore = interactionScores?.get(item.id) || 0;
    const affinity = affinityForItem(profile, item);
    const semantic = candidateSources.includes('semantic') || candidateSources.includes('cold_start')
      ? Math.max(0, Math.min(1, (sourceScore + 1) / 2)) // cosine similarity -> [0,1]
      : 0;
    const cfScore = candidateSources.includes('cf') ? sourceScore : undefined;

    const features = {
      ratingScore: typeof item.rating === 'number' ? item.rating / 5 : 0.7,
      semantic,
      affinity,
      cfScore: cfScore || 0,
      popularity: (item.popularity || 0) / 100,
      interactionScore,
    };

    const heuristic = heuristicScore(item, { prefsForDomain, likedIds, interactionScore, affinity, semantic, cfScore });
    const relevanceScore = useLearnedRanker
      ? learnedRanker.blendScore(heuristic, features)
      : heuristic;

    const explanation = buildExplanation({ item, prefsForDomain, likedIds, interactionScore, affinity, semantic, candidateSources });

    // Never ship the raw embedding vector over the API -- it's an internal
    // retrieval artifact (384 floats), not something a client needs, and it
    // needlessly bloats every response.
    const { embedding, ...publicItem } = item;

    return {
      ...publicItem,
      affinityScore: affinity,
      semanticScore: semantic,
      relevanceScore,
      trendingScore: trendingScore(item),
      candidateSources,
      liked: likedIds?.has(item.id) || false,
      explanation,
    };
  });

  if (mode === 'trending') {
    return scored.sort((a, b) => b.trendingScore - a.trendingScore);
  }
  if (mode === 'for-you') {
    return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  return scored.sort(
    (a, b) => (b.relevanceScore * 0.7 + b.trendingScore * 0.3) - (a.relevanceScore * 0.7 + a.trendingScore * 0.3)
  );
}

function buildExplanation({ item, prefsForDomain, likedIds, interactionScore, affinity, semantic, candidateSources }) {
  const reasons = [];
  if (affinity > 0.15 && item.topic) reasons.push(`Matches your interest in ${item.topic}`);
  if (prefsForDomain?.interested) reasons.push(`You set ${item.domain} as high interest`);
  if (interactionScore > 0) reasons.push('Based on your recent interactions');
  if (likedIds?.has(item.id)) reasons.push('You liked this');
  if (semantic > 0.72) reasons.push('Semantically similar to content you engaged with');
  else if (semantic > 0.62) reasons.push('Semantically similar to your inferred interests');
  if (candidateSources.includes('cf')) reasons.push('Users with similar taste also liked this');
  if (candidateSources.includes('cold_start')) reasons.push('Popular pick to help us learn your taste');
  return { matchedTopics: item.topic ? [item.topic] : [], matchedDomain: item.domain, reasons };
}

module.exports = { rankCandidates, heuristicScore, trendingScore };
