const express = require('express');
const db = require('../db/pool');
const redis = require('../db/redis');
const cfService = require('../services/cfService');
const learnedRanker = require('../services/learnedRanker');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const [dbOk, redisOk] = await Promise.all([db.healthCheck(), redis.healthCheck()]);
    const status = dbOk && redisOk ? 'OK' : 'DEGRADED';
    res.status(dbOk && redisOk ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbOk ? 'ok' : 'unreachable',
        redis: redisOk ? 'ok' : 'unreachable',
        collaborativeFiltering: cfService.isTrained() ? 'trained' : 'not_trained',
        learnedRanker: learnedRanker.isAvailable() ? 'available' : 'unavailable (heuristic fallback active)',
      },
    });
  } catch (err) {
    // Health endpoint must never itself 500 in a way that hides the real
    // dependency status -- report DEGRADED with the error instead.
    res.status(503).json({ status: 'DEGRADED', timestamp: new Date().toISOString(), error: err.message });
  }
});

module.exports = router;
