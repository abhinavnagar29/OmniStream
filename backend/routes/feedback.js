const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { ApiError } = require('../middleware/errors');
const { store } = require('../store/memoryStore');
const { getContent } = require('../services/contentService');

const router = express.Router();

const bodySchema = z
  .object({
    itemId: z.string().min(1),
  })
  .strict();

async function assertItemExists(itemId) {
  const content = await getContent();
  const exists = content.some((c) => c.id === itemId);
  if (!exists) {
    throw new ApiError(404, 'Item not found');
  }
}

router.post('/like', validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    const userId = req.userId;
    store.like(itemId, userId);
    store.addInteraction('like', itemId, userId);
    res.status(201).json({ data: { itemId, liked: true } });
  } catch (e) {
    next(e);
  }
});

router.post('/unlike', validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    const userId = req.userId;
    store.unlike(itemId, userId);
    store.addInteraction('unlike', itemId, userId);
    res.status(201).json({ data: { itemId, liked: false } });
  } catch (e) {
    next(e);
  }
});

router.post('/open', validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    store.addInteraction('open', itemId, req.userId);
    res.status(201).json({ data: { itemId, opened: true } });
  } catch (e) {
    next(e);
  }
});

router.post('/skip', validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const { itemId } = req.body;
    await assertItemExists(itemId);
    store.addInteraction('skip', itemId, req.userId);
    res.status(201).json({ data: { itemId, skipped: true } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
