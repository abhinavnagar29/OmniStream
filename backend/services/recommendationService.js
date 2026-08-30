'use strict';

/**
 * Orchestrator for the two-stage recommender:
 *   Stage 1 (candidateGeneration.js): semantic ANN + CF + trending + cold start
 *   Stage 2 (ranking.js):             heuristic + optional learned-ranker blend
 *   Post:   diversityService.js       MMR-style diversity re-rank
 *
 * This file intentionally contains almost no scoring logic itself --
 * that discipline (retrieval and ranking as separate, independently
 * testable modules) is the actual "two-stage recommender" architectural
 * choice, not a formality.
 */

const contentRepo = require('../db/contentRepo');
const interactionRepo = require('../db/interactionRepo');
const { buildUserProfile } = require('./userModelService');
const { generateCandidates } = require('./candidateGeneration');
const { rankCandidates } = require('./ranking');
const { rerankWithDiversity } = require('./diversityService');
const miscRepo = require('../db/miscRepo');

const DOMAIN_KEYS = ['video', 'music', 'podcast', 'movie', 'news'];
const RECOMMENDATION_MODES = ['home', 'for-you', 'trending'];

async function getRecommendations(userId, { domain, limit = 20, mode = 'home', explore = 0 } = {}) {
  const [preferences, likedIds, interactionScores, interactionRows] = await Promise.all([
    miscRepo.getPreferences(userId),
    interactionRepo.likedContentIds(userId).then((ids) => new Set(ids)),
    interactionRepo.getScoresMap(userId),
    interactionRepo.recentForUser(userId, { limit: 300 }),
  ]);

  const profile = buildUserProfile({ interactionRows, preferences });

  const candidates = await generateCandidates({ userId, domain, preferences, interactionRows });

  const ranked = rankCandidates(candidates, {
    profile,
    preferences,
    likedIds,
    interactionScores,
    mode,
  });

  const diversified = rerankWithDiversity(ranked, explore);
  const page = diversified.slice(0, limit);

  // Log what we served -- this is the "recommendation_events" side of the
  // impressions/clicks join used for A/B analysis (see routes/experiments.js).
  miscRepo
    .logServed(
      userId,
      page.map((item, rank) => ({
        contentId: item.id,
        rank,
        candidateSource: item.candidateSources?.[0],
        score: item.relevanceScore,
      }))
    )
    .catch(() => {}); // best-effort; never block the response on logging

  return page;
}

async function searchContent({ q, domains, sortBy = 'relevance', limit = 30 }) {
  const results = await contentRepo.search(q, { limit: limit ? Number(limit) : 30 });
  let filtered = results;

  if (domains) {
    const domainSet = new Set(String(domains).split(',').map((d) => d.trim().toLowerCase()).filter(Boolean));
    filtered = filtered.filter((item) => domainSet.has(item.domain));
  }

  const sorters = {
    relevance: (a, b) => (b.popularity || 0) - (a.popularity || 0),
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    popularity: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  };
  filtered.sort(sorters[sortBy] || sorters.relevance);

  return filtered;
}

module.exports = { DOMAIN_KEYS, RECOMMENDATION_MODES, getRecommendations, searchContent };
