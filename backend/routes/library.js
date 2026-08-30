const express = require('express');

const { requireAuth } = require('../middleware/auth');
const store = require('../store/dbStore');
const contentRepo = require('../db/contentRepo');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const likedIds = await store.getLikedIds(req.userId);
    const items = await contentRepo.getByIds(Array.from(likedIds));
    res.json({ data: { liked: items } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
