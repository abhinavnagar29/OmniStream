const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const eventStream = require('../db/eventStream');

const router = express.Router();

const bodySchema = z
  .object({
    event: z.string().min(1),
    data: z.unknown().optional(),
  })
  .strict();

/**
 * Async by design (see backend/db/eventStream.js): this enqueues to a Redis
 * Stream and returns immediately. The actual Postgres write happens later,
 * out of the request path, via scripts/worker/analyticsWorker.js. The
 * response is intentionally 202 Accepted (not 201 Created) -- nothing has
 * been persisted to the system of record yet when this returns, only queued.
 */
router.post('/', requireAuth, validate({ body: bodySchema }), async (req, res, next) => {
  try {
    const streamId = await eventStream.publish(req.userId, req.body.event, req.body.data);
    res.status(202).json({ data: { queued: true, streamId, event: req.body.event } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
