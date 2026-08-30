const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { DOMAIN_KEYS, searchContent } = require('../services/recommendationService');

const router = express.Router();

const querySchema = z.object({
  q: z.string().min(1),
  domains: z.string().optional(),
  sortBy: z.enum(['relevance', 'newest', 'oldest', 'rating', 'popularity']).optional().default('relevance'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  '/',
  validate({ query: querySchema }),
  async (req, res, next) => {
    const { q, domains, sortBy, limit } = req.query;

    if (domains) {
      const domainSet = new Set(
        String(domains)
          .split(',')
          .map((d) => String(d).trim().toLowerCase())
          .filter(Boolean)
      );

      for (const d of domainSet) {
        if (!DOMAIN_KEYS.includes(d)) {
          return res.status(400).json({
            error: {
              message: 'Validation error',
              details: { issues: [{ path: ['domains'], message: `Invalid domain: ${d}` }] },
            },
          });
        }
      }
    }

    try {
      const results = await searchContent({ q, domains, sortBy, limit });
      res.json({ data: results });
    } catch (e) {
      next(e);
    }
  }
);

module.exports = router;
