const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errors');
const { DOMAIN_KEYS } = require('../services/recommendationService');
const { store } = require('../store/memoryStore');
const { seedPersonaIfEmpty } = require('../services/personaService');

const router = express.Router();

router.get('/', (_req, res) => {
  const userId = _req.userId;
  seedPersonaIfEmpty(store, userId);
  res.json({ data: store.getPreferences(userId) });
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
  validate({ params: paramsSchema, body: bodySchema }),
  (req, res, next) => {
    const { domain } = req.params;
    const prefs = req.body;
    const userId = req.userId;

    seedPersonaIfEmpty(store, userId);

    if (Object.keys(prefs).length === 0) {
      return next(new ApiError(400, 'At least one preference field is required'));
    }

    const updated = store.setDomainPreferences(domain, prefs, userId);
    res.json({ data: updated });
  }
);

module.exports = router;
