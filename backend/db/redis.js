const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[redis] connection error', err.message);
});

const RECOMMENDATION_TTL_SECONDS = 120;

function recoCacheKey(userId, context) {
  return `recommendations:${userId}:${context || 'default'}`;
}

async function getCachedRecommendations(userId, context) {
  try {
    const raw = await redis.get(recoCacheKey(userId, context));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // cache is an optimization, never a hard dependency
  }
}

async function setCachedRecommendations(userId, context, payload) {
  try {
    await redis.set(recoCacheKey(userId, context), JSON.stringify(payload), 'EX', RECOMMENDATION_TTL_SECONDS);
  } catch {
    /* best-effort */
  }
}

/**
 * Invalidate a user's cached recommendations. Called on any interaction that
 * meaningfully changes their profile (like/unlike/skip/search) -- an
 * `impression` alone does not invalidate, to avoid cache-busting on every
 * scroll.
 */
async function invalidateRecommendations(userId) {
  try {
    const keys = await redis.keys(`recommendations:${userId}:*`);
    if (keys.length) await redis.del(keys);
  } catch {
    /* best-effort */
  }
}

async function healthCheck() {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

module.exports = {
  redis, getCachedRecommendations, setCachedRecommendations, invalidateRecommendations, healthCheck,
};
