const express = require('express');

const { store } = require('../store/memoryStore');
const { buildUserProfile } = require('../services/userModelService');
const { seedPersonaIfEmpty } = require('../services/personaService');

const router = express.Router();

router.get('/', (_req, res) => {
  const userId = _req.userId;
  seedPersonaIfEmpty(store, userId);

  const preferences = store.getPreferences(userId);
  const analyticsEvents = store.getAnalytics(userId);

  const profile = buildUserProfile({ preferences, analyticsEvents });
  res.json({ data: profile });
});

module.exports = router;
