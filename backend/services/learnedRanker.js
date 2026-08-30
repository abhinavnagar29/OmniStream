'use strict';

/**
 * Loads ml/models/ranker_weights.json (a logistic-regression distillation
 * of the LightGBM LambdaMART model trained by ml/train_ranker.py) and
 * blends it with the hand-tuned heuristic score.
 *
 * Why blend instead of fully replacing the heuristic? Two reasons:
 *   1. The learned model is only as good as the (currently simulated)
 *      training data behind it -- blending keeps the system from fully
 *      trusting a model trained on synthetic behavior once real users
 *      arrive, until it's been re-validated (see docs/architecture.md).
 *   2. It gives a graceful fallback: if ranker_weights.json is missing or
 *      malformed, isAvailable() returns false and ranking.js falls back to
 *      the pure heuristic -- the recommender never hard-fails because an ML
 *      artifact didn't ship.
 */

const fs = require('fs');
const path = require('path');

const WEIGHTS_PATH = path.join(__dirname, '..', '..', 'ml', 'models', 'ranker_weights.json');

let cached = null;
let cachedMtimeMs = 0;

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function load() {
  if (!fs.existsSync(WEIGHTS_PATH)) return null;
  const stat = fs.statSync(WEIGHTS_PATH);
  if (cached && stat.mtimeMs === cachedMtimeMs) return cached;
  try {
    cached = JSON.parse(fs.readFileSync(WEIGHTS_PATH, 'utf8'));
    cachedMtimeMs = stat.mtimeMs;
    return cached;
  } catch {
    return null;
  }
}

function isAvailable() {
  return load() !== null;
}

/**
 * @param {number} heuristicScore - the existing hand-tuned score, 0..~1.3
 * @param {{ratingScore,semantic,affinity,cfScore,popularity,interactionScore}} features
 */
function blendScore(heuristicScore, features) {
  const model = load();
  if (!model) return heuristicScore;

  const { weights, intercept, featureOrder } = model;
  let z = intercept;
  for (const name of featureOrder) {
    const key = name === 'recency' ? null : name; // recency isn't in the runtime feature set (computed inline); skip gracefully
    if (key && Object.prototype.hasOwnProperty.call(features, key)) {
      z += weights[name] * features[key];
    }
  }
  const learnedProb = sigmoid(z); // 0..1, "probability this is a good recommendation"

  // Blend: 60% learned model, 40% heuristic -- keeps hand-tuned business
  // logic (e.g. explicit domain preference boosts) from being fully
  // overridden by a model trained on simulated data.
  return 0.6 * learnedProb + 0.4 * heuristicScore;
}

module.exports = { isAvailable, blendScore, WEIGHTS_PATH };
