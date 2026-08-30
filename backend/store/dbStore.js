'use strict';

/**
 * Same method surface as the original backend/store/memoryStore.js, but
 * every method now hits Postgres via the repos in backend/db/*, and every
 * method is async (routes must `await` accordingly -- this was a deliberate
 * breaking change from the in-memory version, not an oversight).
 *
 * Why keep the same method names instead of restructuring every route?
 * Because the recommendation/diversity/explainability logic that actually
 * matters for this project lives in the services layer, not the routes --
 * minimizing route churn here keeps the diff reviewable and lets tests
 * isolate whether a regression came from persistence or from the
 * recommender itself.
 */

const interactionRepo = require('../db/interactionRepo');
const analyticsRepo = require('../db/analyticsRepo');
const miscRepo = require('../db/miscRepo');

async function getPreferences(userId) {
  return miscRepo.getPreferences(userId);
}

async function setDomainPreferences(domain, prefs, userId) {
  return miscRepo.setDomainPreferences(userId, domain, prefs);
}

async function addAnalyticsEvent(event, data, userId) {
  return analyticsRepo.add(userId, event, data);
}

async function getLikedIds(userId) {
  const ids = await interactionRepo.likedContentIds(userId);
  return new Set(ids);
}

async function like(itemId, userId) {
  await interactionRepo.record(userId, itemId, 'like');
}

async function unlike(itemId, userId) {
  await interactionRepo.record(userId, itemId, 'unlike');
}

async function getInteractionScores(userId) {
  return interactionRepo.getScoresMap(userId);
}

async function addInteraction(type, itemId, userId) {
  const row = await interactionRepo.record(userId, itemId, type);
  await analyticsRepo.add(userId, type, { itemId });
  return row.weight;
}

async function getAnalytics(userId) {
  return analyticsRepo.forUser(userId);
}

module.exports = {
  getPreferences, setDomainPreferences, addAnalyticsEvent,
  getLikedIds, like, unlike, getInteractionScores, addInteraction, getAnalytics,
};
