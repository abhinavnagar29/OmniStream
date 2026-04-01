const express = require('express');

const { listPersonas } = require('../services/personaService');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ data: listPersonas() });
});

module.exports = router;
