const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errors');
const { requireAuth } = require('../middleware/auth');
const store = require('../store/dbStore');
const contentRepo = require('../db/contentRepo');
const { invalidateRecommendations } = require('../db/redis');

const router = express.Router();

const bodySchema = z
  .object({
    itemId: z.string().min(1),
  })
  .strict();

async function assertItemExists(itemId) {
  const item = await contentRepo.getById(itemId);
  if (!item) {
    throw new ApiError(404, 'Item not found');
  }
}

router.post('/like', requireAuth, validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    const userId = req.userId;
    await store.like(itemId, userId);
    await invalidateRecommendations(userId);
    res.status(201).json({ data: { itemId, liked: true } });
  } catch (e) {
    next(e);
  }
});

router.post('/unlike', requireAuth, validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    const userId = req.userId;
    await store.unlike(itemId, userId);
    await invalidateRecommendations(userId);
    res.status(201).json({ data: { itemId, liked: false } });
  } catch (e) {
    next(e);
  }
});

router.post('/open', requireAuth, validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    await store.addInteraction('open', itemId, req.userId);
    await invalidateRecommendations(req.userId);
    res.status(201).json({ data: { itemId, opened: true } });
  } catch (e) {
    next(e);
  }
});

router.post('/skip', requireAuth, validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    await store.addInteraction('skip', itemId, req.userId);
    await invalidateRecommendations(req.userId);
    res.status(201).json({ data: { itemId, skipped: true } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
