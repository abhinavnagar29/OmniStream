const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { DOMAIN_KEYS, RECOMMENDATION_MODES, getRecommendations } = require('../services/recommendationService');
const { seedPersonaIfEmpty } = require('../services/personaService');
const store = require('../store/dbStore');
const userRepo = require('../db/userRepo');
const redisCache = require('../db/redis');

const router = express.Router();

const querySchema = z.object({
  domain: z.enum(DOMAIN_KEYS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  mode: z.enum(RECOMMENDATION_MODES).optional(),
  explore: z.coerce.number().min(0).max(1).optional(),
});

router.get(
  '/',
  requireAuth,
  validate({ query: querySchema }),
  async (req, res, next) => {
    const userId = req.userId;
    try {
      const user = await userRepo.findById(userId);
      if (user?.persona) await seedPersonaIfEmpty(store, userId, user.persona);

      const cacheKey = JSON.stringify(req.query);
      const cached = await redisCache.getCachedRecommendations(userId, cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json({ data: cached });
      }

      const recs = await getRecommendations(userId, req.query);
      await redisCache.setCachedRecommendations(userId, cacheKey, recs);
      res.set('X-Cache', 'MISS');
      res.json({ data: recs });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
