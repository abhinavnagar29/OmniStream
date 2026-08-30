const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepo = require('../db/userRepo');

const BCRYPT_ROUNDS = 12;

function assertSecretConfigured() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Refusing to sign tokens with no secret.');
  }
}

async function signup({ email, password, displayName }) {
  assertSecretConfigured();
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.status = 409;
    throw err;
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await userRepo.createUser({ email, passwordHash, displayName });
  const token = issueToken(user);
  return { user, token };
}

async function login({ email, password }) {
  assertSecretConfigured();
  const user = await userRepo.findByEmail(email);
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }
  const token = issueToken(user);
  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token };
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signup, login, issueToken, verifyToken };
