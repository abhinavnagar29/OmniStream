'use strict';

/**
 * Collaborative filtering candidate source.
 *
 * Reads latent user/item factors trained offline by ml/train_cf.py (matrix
 * factorization over the implicit-feedback interaction matrix) and serves
 * "users like you liked X" candidates via a dot-product score.
 *
 * IMPORTANT / HONESTY NOTE: this project has no real user base yet, so the
 * training data behind these factors comes from
 * scripts/simulate/generateInteractions.js -- a documented, labeled
 * interaction *simulator* (genre-affinity-driven synthetic users), not real
 * people. The factorization math, the serving path, and the evaluation
 * harness are all real; the training signal is synthetic until real users
 * exist. See docs/architecture.md, "collaborative filtering: data
 * provenance" for the full explanation.
 *
 * A user who isn't in the trained factor set (e.g. a freshly signed-up real
 * user) simply gets no CF candidates -- candidateGeneration.js treats that
 * as expected and falls back to the semantic + trending sources.
 */

const fs = require('fs');
const path = require('path');
const contentRepo = require('../db/contentRepo');

const FACTORS_PATH = path.join(__dirname, '..', '..', 'ml', 'models', 'cf_factors.json');

let cached = null;
let cachedMtimeMs = 0;

function loadFactors() {
  if (!fs.existsSync(FACTORS_PATH)) return null;
  const stat = fs.statSync(FACTORS_PATH);
  if (cached && stat.mtimeMs === cachedMtimeMs) return cached;

  const raw = JSON.parse(fs.readFileSync(FACTORS_PATH, 'utf8'));
  cached = raw;
  cachedMtimeMs = stat.mtimeMs;
  return raw;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

async function getCfCandidates(userId, { limit = 200, domain = null } = {}) {
  const factors = loadFactors();
  if (!factors) return [];

  const userVec = factors.userFactors[userId];
  if (!userVec) return []; // user not in the (simulated) training set -- expected for real new users

  const scored = Object.entries(factors.itemFactors)
    .map(([itemId, itemVec]) => ({ itemId, cfScore: dot(userVec, itemVec) }))
    .sort((a, b) => b.cfScore - a.cfScore)
    .slice(0, limit * 2); // overfetch before the domain/content join filters some out

  const items = await contentRepo.getByIds(scored.map((s) => s.itemId));
  const byId = new Map(items.map((i) => [i.id, i]));

  const out = [];
  for (const s of scored) {
    const item = byId.get(s.itemId);
    if (!item) continue;
    if (domain && item.domain !== domain) continue;
    out.push({ ...item, cfScore: s.cfScore });
    if (out.length >= limit) break;
  }
  return out;
}

function isTrained() {
  return fs.existsSync(FACTORS_PATH);
}

module.exports = { getCfCandidates, isTrained, FACTORS_PATH };
