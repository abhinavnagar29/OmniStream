const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
