const express = require('express');

const { store } = require('../store/memoryStore');
const { getContent } = require('../services/contentService');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const likedIds = store.getLikedIds(_req.userId);
    const content = await getContent();
    const items = content.filter((c) => likedIds.has(c.id));
    res.json({ data: { liked: items } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
