'use strict';

/**
 * Redis Streams-backed event queue for analytics events specifically.
 *
 * DESIGN DECISION (documented, not accidental): `like`/`unlike`/`open`/`skip`
 * interactions stay SYNCHRONOUS (written directly to Postgres in the
 * request path, see backend/store/dbStore.js) because the library page and
 * user profile need read-your-own-write consistency immediately after
 * them -- a user who likes something and immediately reloads their library
 * should see it there, not "eventually." Generic analytics events
 * (POST /api/analytics -- arbitrary, high-volume, nothing reads them back
 * synchronously) are exactly the case async decoupling is for for: the API
 * response doesn't need to wait on a Postgres write it doesn't depend on.
 *
 * Flow: API enqueues (XADD) -> responds immediately -> a separate worker
 * process (scripts/worker/analyticsWorker.js) reads the stream via a
 * consumer group, writes to Postgres, retries on failure, and moves
 * permanently-failing messages to a dead-letter stream instead of losing
 * them or blocking the queue forever.
 */

const { redis } = require('./redis');

const STREAM_KEY = 'stream:analytics_events';
const DLQ_KEY = 'stream:analytics_events:dlq';
const GROUP = 'analytics_workers';

async function ensureGroup() {
  try {
    await redis.xgroup('CREATE', STREAM_KEY, GROUP, '0', 'MKSTREAM');
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err; // group already exists -- fine
  }
}

/** Enqueue an analytics event. Fire-and-forget from the caller's perspective -- fast, non-blocking. */
async function publish(userId, event, data) {
  const id = await redis.xadd(
    STREAM_KEY,
    '*',
    'userId', userId,
    'event', event,
    'data', data !== undefined ? JSON.stringify(data) : '',
    'enqueuedAt', String(Date.now())
  );
  return id;
}

async function streamLength() {
  return redis.xlen(STREAM_KEY);
}

async function pendingCount() {
  await ensureGroup();
  const info = await redis.xpending(STREAM_KEY, GROUP);
  return Array.isArray(info) ? Number(info[0]) || 0 : 0;
}

async function dlqLength() {
  return redis.xlen(DLQ_KEY);
}

module.exports = { STREAM_KEY, DLQ_KEY, GROUP, ensureGroup, publish, streamLength, pendingCount, dlqLength };
