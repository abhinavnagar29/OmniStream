const express = require('express');

const { getContent } = require('../services/contentService');
const { store } = require('../store/memoryStore');
const { buildUserProfile } = require('../services/userModelService');
const { seedPersonaIfEmpty } = require('../services/personaService');
const { getRecommendations } = require('../services/recommendationService');

const router = express.Router();

function countBy(arr, keyFn) {
  const out = {};
  for (const x of arr) {
    const k = keyFn(x);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function entropyScore(countsObj) {
  const entries = Object.entries(countsObj || {});
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (!total) return 0;
  let h = 0;
  for (const [, c] of entries) {
    const p = c / total;
    if (p > 0) h += -p * Math.log(p);
  }
  const k = entries.length;
  if (k <= 1) return 0;
  return h / Math.log(k);
}

router.get('/', async (req, res, next) => {
  const userId = req.userId;
  seedPersonaIfEmpty(store, userId);

  const preferences = store.getPreferences(userId);
  const analyticsEvents = store.getAnalytics(userId);
  const likedIds = store.getLikedIds(userId);

  const profile = buildUserProfile({ preferences, analyticsEvents });

  const likedCount = likedIds.size;
  const engagementCounts = countBy(analyticsEvents, (e) => e.event);

  try {
    const content = await getContent();

    const topN = 20;
    const recs = await getRecommendations(
      { mode: 'for-you', limit: topN, explore: 0 },
      preferences,
      likedIds,
      store.getInteractionScores(userId),
      analyticsEvents
    );

    const domainCountsTopN = countBy(recs, (x) => x.domain || 'unknown');
    const topicCountsTopN = countBy(recs, (x) => x.topic || 'unknown');
    const domainCoverage = Object.keys(domainCountsTopN).length / 5;
    const diversity = entropyScore(topicCountsTopN);

    const ages = recs
      .map((x) => {
        const t = Date.parse(x.createdAt || 0);
        if (!t) return null;
        return Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
      })
      .filter((x) => typeof x === 'number');
    const avgAgeDays = ages.length ? ages.reduce((s, x) => s + x, 0) / ages.length : 0;
    const novelty = clamp01(avgAgeDays / 60);

    const topTopicWeight = profile?.summary?.topTopics?.[0]?.weight;
    const personalizationConfidence = clamp01(typeof topTopicWeight === 'number' ? Math.abs(topTopicWeight) : 0);

    const explained = recs.filter((x) => Array.isArray(x?.explanation?.reasons) && x.explanation.reasons.length > 0).length;
    const explanationCoverage = recs.length ? explained / recs.length : 0;

    // Trending topics/items based on popularity
    const topTopics = Object.entries(countBy(content, (c) => c.topic))
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topItems = content
      .slice()
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10)
      .map((x) => ({ id: x.id, title: x.title, domain: x.domain, topic: x.topic, popularity: x.popularity }));

    res.json({
      data: {
        userId,
        likedCount,
        engagementCounts,
        profileSummary: profile.summary,
        trending: {
          topTopics,
          topItems,
        },
        dataset: {
          totalItems: content.length,
          domainCounts: countBy(content, (c) => c.domain),
        },
        recommender: {
          topN,
          domainCoverage: Math.round(domainCoverage * 100) / 100,
          diversity: Math.round(diversity * 100) / 100,
          novelty: Math.round(novelty * 100) / 100,
          personalizationConfidence: Math.round(personalizationConfidence * 100) / 100,
          explanationCoverage: Math.round(explanationCoverage * 100) / 100,
          domainCountsTopN,
          topicCountsTopN,
        },
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
