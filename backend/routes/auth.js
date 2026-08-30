const express = require('express');
const { z } = require('zod');
const authService = require('../services/authService');
const userRepo = require('../db/userRepo');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', validate({ body: signupSchema }), async (req, res, next) => {
  try {
    const { user, token } = await authService.signup(req.body);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { user, token } = await authService.login(req.body);
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await userRepo.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ data: user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
