const { randomUUID } = require('crypto');

const DEFAULT_USER_ID = 'demo';

function createMemoryStore() {
  const preferencesByUser = new Map();
  const analyticsEvents = [];
  const likedByUser = new Map();
  const interactionScoreByUser = new Map();

  function getInteractionScores(userId = DEFAULT_USER_ID) {
    if (!interactionScoreByUser.has(userId)) interactionScoreByUser.set(userId, new Map());
    return interactionScoreByUser.get(userId);
  }

  function getPreferences(userId = DEFAULT_USER_ID) {
    return preferencesByUser.get(userId) || {};
  }

  function setDomainPreferences(domain, prefs, userId = DEFAULT_USER_ID) {
    const existing = getPreferences(userId);
    const next = {
      ...existing,
      [domain]: {
        ...(existing[domain] || {}),
        ...prefs,
      },
    };
    preferencesByUser.set(userId, next);
    return next[domain];
  }

  function addAnalyticsEvent(event, data, userId = DEFAULT_USER_ID) {
    const row = {
      id: randomUUID(),
      userId,
      event,
      data,
      at: new Date().toISOString(),
    };
    analyticsEvents.push(row);
    return row;
  }

  function getLikedIds(userId = DEFAULT_USER_ID) {
    if (!likedByUser.has(userId)) likedByUser.set(userId, new Set());
    return likedByUser.get(userId);
  }

  function like(itemId, userId = DEFAULT_USER_ID) {
    const liked = getLikedIds(userId);
    liked.add(itemId);
  }

  function unlike(itemId, userId = DEFAULT_USER_ID) {
    const liked = getLikedIds(userId);
    liked.delete(itemId);
  }

  function addInteraction(type, itemId, userId = DEFAULT_USER_ID) {
    const scores = getInteractionScores(userId);
    const prev = scores.get(itemId) || 0;

    // Simple implicit feedback weights
    const delta =
      type === 'like'
        ? 3
        : type === 'unlike'
          ? -3
          : type === 'open'
            ? 1
            : type === 'skip'
              ? -2
              : 0;

    scores.set(itemId, prev + delta);
    addAnalyticsEvent(type, { itemId }, userId);
    return scores.get(itemId);
  }

  function getAnalytics(userId = DEFAULT_USER_ID) {
    return analyticsEvents.filter((e) => e.userId === userId);
  }

  return {
    DEFAULT_USER_ID,
    getPreferences,
    setDomainPreferences,
    addAnalyticsEvent,
    getLikedIds,
    like,
    unlike,
    getInteractionScores,
    addInteraction,
    getAnalytics,
  };
}

const store = createMemoryStore();

module.exports = { store, createMemoryStore };
