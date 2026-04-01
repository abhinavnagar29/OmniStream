const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { DOMAIN_KEYS, RECOMMENDATION_MODES, getRecommendations } = require('../services/recommendationService');
const { store } = require('../store/memoryStore');
const { seedPersonaIfEmpty } = require('../services/personaService');

const router = express.Router();

const querySchema = z.object({
  domain: z.enum(DOMAIN_KEYS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  mode: z.enum(RECOMMENDATION_MODES).optional(),
  explore: z.coerce.number().min(0).max(1).optional(),
});

router.get(
  '/',
  validate({ query: querySchema }),
  async (req, res, next) => {
    const userId = req.userId;
    seedPersonaIfEmpty(store, userId);

    const preferences = store.getPreferences(userId);
    const likedIds = store.getLikedIds(userId);
    const interactionScores = store.getInteractionScores(userId);
    const analyticsEvents = store.getAnalytics(userId);
    try {
      const recs = await getRecommendations(req.query, preferences, likedIds, interactionScores, analyticsEvents);
      res.json({ data: recs });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
