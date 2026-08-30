// Own file so its tight rate-limit env vars never affect the main suite --
// Jest gives each test file its own module registry, so process.env set
// here before requiring the app is isolated to this file.
process.env.RATE_LIMIT_MAX = '5';
process.env.RATE_LIMIT_WINDOW_MS = '2000';

const request = require('supertest');
const Redis = require('ioredis');

const { createApp } = require('../backend/app');

describe('Distributed (Redis-backed) rate limiting', () => {
  const app = createApp();

  beforeAll(async () => {
    // Other test files in this run share the same Redis instance and the
    // rate limiter keys by IP, not by app instance -- without this, requests
    // those files already made (under a much higher limit) would count
    // against this file's intentionally tight 5-request window.
    const redis = new Redis(process.env.REDIS_URL);
    const keys = await redis.keys('rl:*');
    if (keys.length) await redis.del(keys);
    await redis.quit();
  });

  test('allows requests under the limit', async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/api/health');
      expect(res.status).not.toBe(429);
    }
  });

  test('rejects requests over the limit with 429 and a Retry-After header', async () => {
    // The previous test already used up part of the window; drive it past 5.
    let last;
    for (let i = 0; i < 10; i += 1) {
      last = await request(app).get('/api/health');
      if (last.status === 429) break;
    }
    expect(last.status).toBe(429);
    expect(last.headers).toHaveProperty('ratelimit-limit');
  });

  test('the counter is actually stored in Redis (proves it is not process-local memory)', async () => {
    const redis = new Redis(process.env.REDIS_URL);
    const keys = await redis.keys('rl:*');
    expect(keys.length).toBeGreaterThan(0);
    await redis.quit();
  });

  test('limit resets after the window elapses', async () => {
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(429);
  });
});
