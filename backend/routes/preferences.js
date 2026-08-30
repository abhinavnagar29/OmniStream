const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const { DOMAIN_KEYS } = require('../services/recommendationService');
const store = require('../store/dbStore');
const userRepo = require('../db/userRepo');
const { seedPersonaIfEmpty } = require('../services/personaService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const user = await userRepo.findById(userId);
    if (user?.persona) await seedPersonaIfEmpty(store, userId, user.persona);
    res.json({ data: await store.getPreferences(userId) });
  } catch (e) {
    next(e);
  }
});

const paramsSchema = z.object({
  domain: z.enum(DOMAIN_KEYS),
});

const bodySchema = z
  .object({
    interested: z.boolean().optional(),
    neutral: z.boolean().optional(),
    categories: z.union([z.string(), z.array(z.string())]).optional(),
    rating: z.string().optional(),
    language: z.string().optional(),
    notifications: z.boolean().optional(),
  })
  .strict();

router.post(
  '/:domain',
  requireAuth,
  validate({ params: paramsSchema, body: bodySchema }),
  async (req, res, next) => {
    try {
      const { domain } = req.params;
      const prefs = req.body;
      const userId = req.userId;

      if (Object.keys(prefs).length === 0) {
        return next(new ApiError(400, 'At least one preference field is required'));
      }

      const updated = await store.setDomainPreferences(domain, prefs, userId);
      res.json({ data: updated });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
