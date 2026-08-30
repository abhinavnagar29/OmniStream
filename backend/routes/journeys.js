const express = require('express');

const { requireAuth } = require('../middleware/auth');
const store = require('../store/dbStore');
const interactionRepo = require('../db/interactionRepo');
const { buildUserProfile } = require('../services/userModelService');
const { getRecommendations } = require('../services/recommendationService');
const { generateJourneys } = require('../services/journeyService');

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const [preferences, interactionRows] = await Promise.all([
      store.getPreferences(userId),
      interactionRepo.recentForUser(userId, { limit: 300 }),
    ]);
    const profile = buildUserProfile({ interactionRows, preferences });

    const recs = await getRecommendations(userId, { mode: 'for-you', limit: 80 });
    const journeys = generateJourneys(profile, recs, 3);
    res.json({ data: journeys });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
