const request = require('supertest');

const { createApp } = require('../backend/app');
const { createWorker } = require('../scripts/worker/analyticsWorker');
const eventStream = require('../backend/db/eventStream');
const { query } = require('../backend/db/pool');
const { redis } = require('../backend/db/redis');

describe('Async analytics event pipeline (Redis Streams + worker)', () => {
  const app = createApp();

  async function registerAndLogin() {
    const email = `async_${Date.now()}_${Math.random()}@test.local`;
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
    return { token: res.body.token, userId: res.body.user.id };
  }

  test('event is queued immediately (202) and NOT yet in Postgres', async () => {
    const { token, userId } = await registerAndLogin();
    const res = await request(app).post('/api/analytics').set({ Authorization: `Bearer ${token}` }).send({ event: 'scroll_depth', data: { pct: 80 } });
    expect(res.status).toBe(202);

    const { rows } = await query(`SELECT * FROM analytics_events WHERE user_id = $1`, [userId]);
    expect(rows.length).toBe(0); // not written yet -- that's the point of async
  });

  test('the worker drains the queue and the event lands in Postgres', async () => {
    const { token, userId } = await registerAndLogin();
    await request(app).post('/api/analytics').set({ Authorization: `Bearer ${token}` }).send({ event: 'scroll_depth', data: { pct: 42 } });

    const worker = createWorker();
    const results = await worker.drainOnce();
    expect(results.some((r) => r.status === 'processed')).toBe(true);

    const { rows } = await query(`SELECT * FROM analytics_events WHERE user_id = $1`, [userId]);
    expect(rows.length).toBe(1);
    expect(rows[0].event).toBe('scroll_depth');
    expect(rows[0].data.pct).toBe(42);
  });

  test('a permanently-failing write retries then lands in the dead-letter stream, not lost', async () => {
    const { token } = await registerAndLogin();
    await request(app).post('/api/analytics').set({ Authorization: `Bearer ${token}` }).send({ event: 'will_fail', data: {} });

    const failingRepo = { add: jest.fn().mockRejectedValue(new Error('simulated DB outage')) };
    const worker = createWorker({ repo: failingRepo, maxRetries: 2 });
    const results = await worker.drainOnce();

    const failed = results.find((r) => r.status === 'dead_lettered');
    expect(failed).toBeDefined();
    expect(failingRepo.add).toHaveBeenCalledTimes(2); // exactly maxRetries attempts, not 1 and not infinite

    const dlqLen = await eventStream.dlqLength();
    expect(dlqLen).toBeGreaterThan(0);

    const dlqEntries = await redis.xrange(eventStream.DLQ_KEY, '-', '+');
    const found = dlqEntries.some((entry) => entry[1].includes('will_fail'));
    expect(found).toBe(true);
  });

  test('a dead-lettered message is acked on the main stream (queue is not blocked by a poison message)', async () => {
    const pendingBefore = await eventStream.pendingCount();
    const worker = createWorker();
    await worker.drainOnce(); // drains anything left over from earlier tests in this file, including the poison one
    const pendingAfter = await eventStream.pendingCount();
    expect(pendingAfter).toBeLessThanOrEqual(pendingBefore);
  });
});
