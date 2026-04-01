const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errors');
const { store } = require('../store/memoryStore');

const router = express.Router();

const TOPICS = ['ai', 'startups', 'sports', 'wellness', 'space', 'finance'];
const DOMAINS = ['video', 'music', 'podcast', 'movie', 'news'];
const GOALS = ['learn', 'relax', 'stay_updated', 'entertain'];

const bodySchema = z
  .object({
    topics: z.array(z.enum(TOPICS)).min(1).max(6),
    domains: z.array(z.enum(DOMAINS)).min(1).max(5),
    goals: z.array(z.enum(GOALS)).min(1).max(4),
  })
  .strict();

router.post('/', validate({ body: bodySchema }), (req, res, next) => {
  try {
    const userId = req.userId;
    const { topics, domains, goals } = req.body;

    const existing = store.getPreferences(userId);
    if (existing && Object.keys(existing).length > 0) {
      throw new ApiError(409, 'Onboarding already completed for this user');
    }

    const categories = Array.from(new Set([...topics, ...goals]));

    for (const d of domains) {
      store.setDomainPreferences(
        d,
        {
          interested: true,
          categories: categories.join(','),
          language: 'en',
        },
        userId
      );
    }

    // Set non-selected domains to neutral baseline
    for (const d of DOMAINS) {
      if (domains.includes(d)) continue;
      store.setDomainPreferences(
        d,
        {
          neutral: true,
          categories: topics.join(','),
          language: 'en',
        },
        userId
      );
    }

    res.status(201).json({ data: { userId, seeded: true } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
