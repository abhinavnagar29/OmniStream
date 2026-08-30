const express = require('express');

const { requireAuth } = require('../middleware/auth');
const store = require('../store/dbStore');
const interactionRepo = require('../db/interactionRepo');
const { buildUserProfile } = require('../services/userModelService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const [preferences, interactionRows] = await Promise.all([
      store.getPreferences(userId),
      interactionRepo.recentForUser(userId, { limit: 300 }),
    ]);
    const profile = buildUserProfile({ interactionRows, preferences });
    res.json({ data: profile });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
