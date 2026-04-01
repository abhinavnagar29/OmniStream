const express = require('express');

const { store } = require('../store/memoryStore');
const { buildUserProfile } = require('../services/userModelService');
const { getRecommendations } = require('../services/recommendationService');
const { seedPersonaIfEmpty } = require('../services/personaService');
const { generateJourneys } = require('../services/journeyService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  const userId = req.userId;
  seedPersonaIfEmpty(store, userId);

  const preferences = store.getPreferences(userId);
  const likedIds = store.getLikedIds(userId);
  const interactionScores = store.getInteractionScores(userId);
  const analyticsEvents = store.getAnalytics(userId);

  const profile = buildUserProfile({ preferences, analyticsEvents });

  try {
    const recs = await getRecommendations(
      { mode: 'for-you', limit: 80 },
      preferences,
      likedIds,
      interactionScores,
      analyticsEvents
    );

    const journeys = generateJourneys(profile, recs, 3);
    res.json({ data: journeys });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
