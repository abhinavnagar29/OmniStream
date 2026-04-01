const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { store } = require('../store/memoryStore');

const router = express.Router();

const bodySchema = z
  .object({
    event: z.string().min(1),
    data: z.unknown().optional(),
  })
  .strict();

router.post('/', validate({ body: bodySchema }), (req, res) => {
  const row = store.addAnalyticsEvent(req.body.event, req.body.data, req.userId);
  res.status(201).json({ data: row });
});

module.exports = router;
