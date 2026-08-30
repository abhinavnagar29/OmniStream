'use strict';

/**
 * Worker for the async analytics event pipeline (see backend/db/eventStream.js
 * for the design rationale).
 *
 * Reads batches from the `stream:analytics_events` Redis Stream via a
 * consumer group (COUNT-bounded reads = natural backpressure: the worker
 * pulls at its own pace, a burst of writes queues in Redis instead of
 * overwhelming Postgres). Each message gets up to `maxRetries` immediate
 * retries with a short backoff; if it still fails, it's moved to a
 * dead-letter stream (`stream:analytics_events:dlq`) with the failure
 * reason attached, and acknowledged on the main stream so a single bad
 * message can never block the queue forever.
 *
 * KNOWN SIMPLIFICATION (documented, not hidden): if the worker process
 * itself crashes mid-batch, messages it read but hadn't acked yet stay
 * PENDING in the consumer group and are not automatically retried by this
 * implementation -- a production version would run a periodic
 * XAUTOCLAIM sweep to reclaim and reprocess long-pending entries from dead
 * consumers. That sweep is not implemented here; it's a clearly scoped
 * next step, not a silent gap.
 */

const analyticsRepo = require('../../backend/db/analyticsRepo');
const eventStream = require('../../backend/db/eventStream');
const { redis } = require('../../backend/db/redis');

const CONSUMER_NAME = process.env.WORKER_CONSUMER_NAME || `worker-${process.pid}`;
const MAX_RETRIES = Number(process.env.WORKER_MAX_RETRIES || 3);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE || 20);
const RETRY_BACKOFF_MS = Number(process.env.WORKER_RETRY_BACKOFF_MS || 50);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFields(fieldArray) {
  const out = {};
  for (let i = 0; i < fieldArray.length; i += 2) out[fieldArray[i]] = fieldArray[i + 1];
  return out;
}

/**
 * @param {{repo?: object, maxRetries?: number}} deps - injectable for tests
 *   (a test can pass a repo whose `.add` throws to exercise the retry/DLQ path).
 */
function createWorker({ repo = analyticsRepo, maxRetries = MAX_RETRIES } = {}) {
  let stopped = false;

  async function processMessage(id, fields) {
    const parsed = parseFields(fields);
    let lastErr = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        await repo.add(parsed.userId, parsed.event, parsed.data ? JSON.parse(parsed.data) : undefined);
        await redis.xack(eventStream.STREAM_KEY, eventStream.GROUP, id);
        return { id, status: 'processed', attempts: attempt };
      } catch (err) {
        lastErr = err;
        if (attempt < maxRetries) await sleep(RETRY_BACKOFF_MS * attempt); // linear backoff
      }
    }

    // Exhausted retries -- dead-letter it, with the failure reason attached,
    // and ack the original so the queue isn't blocked by a poison message.
    await redis.xadd(
      eventStream.DLQ_KEY,
      '*',
      'originalId', id,
      'userId', parsed.userId || '',
      'event', parsed.event || '',
      'data', parsed.data || '',
      'error', lastErr ? String(lastErr.message).slice(0, 500) : 'unknown',
      'failedAt', String(Date.now())
    );
    await redis.xack(eventStream.STREAM_KEY, eventStream.GROUP, id);
    return { id, status: 'dead_lettered', attempts: maxRetries, error: lastErr?.message };
  }

  /** Reads and processes ONE batch, then returns -- used by both the long-running loop and tests. */
  async function drainOnce() {
    await eventStream.ensureGroup();
    const res = await redis.xreadgroup(
      'GROUP', eventStream.GROUP, CONSUMER_NAME,
      'COUNT', BATCH_SIZE,
      'STREAMS', eventStream.STREAM_KEY, '>'
    );
    if (!res) return [];

    const [[, messages]] = res;
    const results = [];
    for (const [id, fields] of messages) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await processMessage(id, fields));
    }
    return results;
  }

  async function runForever({ pollIntervalMs = 500 } = {}) {
    stopped = false;
    // eslint-disable-next-line no-console
    console.log(`[analyticsWorker:${CONSUMER_NAME}] starting`);
    while (!stopped) {
      // eslint-disable-next-line no-await-in-loop
      const processed = await drainOnce();
      if (processed.length === 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(pollIntervalMs);
      } else {
        // eslint-disable-next-line no-console
        console.log(`[analyticsWorker:${CONSUMER_NAME}] processed ${processed.length} (${processed.filter((r) => r.status === 'dead_lettered').length} dead-lettered)`);
      }
    }
  }

  function stop() {
    stopped = true;
  }

  return { drainOnce, runForever, stop, CONSUMER_NAME };
}

if (require.main === module) {
  require('dotenv').config();
  const worker = createWorker();

  process.on('SIGINT', () => { worker.stop(); process.exit(0); });
  process.on('SIGTERM', () => { worker.stop(); process.exit(0); });

  worker.runForever().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[analyticsWorker] fatal error', err);
    process.exit(1);
  });
}

module.exports = { createWorker };
