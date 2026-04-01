'use strict';

const crypto = require('node:crypto');

const DEFAULT_DIM = 128;

function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function toUnit(vec) {
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i += 1) out[i] = vec[i] / norm;
  return out;
}

function cosineSim(a, b) {
  if (!a || !b) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    an += a[i] * a[i];
    bn += b[i] * b[i];
  }
  const denom = (Math.sqrt(an) || 1) * (Math.sqrt(bn) || 1);
  return dot / denom;
}

function stableHashToIndex(token, dim) {
  const h = crypto.createHash('sha256').update(token).digest();
  const v = h.readUInt32LE(0);
  return v % dim;
}

function stableHashToSign(token) {
  const h = crypto.createHash('sha256').update(`${token}:sign`).digest();
  return (h[0] % 2) === 0 ? 1 : -1;
}

function embedDeterministic(text, dim = DEFAULT_DIM) {
  const s = String(text || '').toLowerCase();
  const tokens = s
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2048);

  const vec = new Float32Array(dim);
  for (const tok of tokens) {
    const idx = stableHashToIndex(tok, dim);
    const sign = stableHashToSign(tok);
    vec[idx] += sign;
  }
  return toUnit(vec);
}

let transformerPipelinePromise = null;

async function getTransformerPipeline() {
  if (process.env.NODE_ENV === 'test') return null;
  if (transformerPipelinePromise) return transformerPipelinePromise;

  transformerPipelinePromise = (async () => {
    try {
      const mod = await import('@xenova/transformers');
      const pipeline = mod.pipeline;
      if (typeof pipeline !== 'function') return null;

      const p = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      });

      return p;
    } catch (_) {
      return null;
    }
  })();

  return transformerPipelinePromise;
}

async function embedWithTransformers(text) {
  const p = await getTransformerPipeline();
  if (!p) return null;

  const out = await p(String(text || ''), {
    pooling: 'mean',
    normalize: true,
  });

  const data = out?.data;
  if (!data) return null;

  if (data instanceof Float32Array) return data;
  if (Array.isArray(data)) return Float32Array.from(data);
  if (ArrayBuffer.isView(data)) return new Float32Array(data);

  return null;
}

const cache = new Map();

function cacheKey(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex');
}

async function embedText(text, { dim = DEFAULT_DIM } = {}) {
  const key = cacheKey(text);
  const cached = cache.get(key);
  if (cached) return cached;

  let vec = null;
  vec = await embedWithTransformers(text);
  if (!vec) vec = embedDeterministic(text, dim);

  cache.set(key, vec);
  return vec;
}

function semanticScore(sim) {
  return clamp01((sim + 1) / 2);
}

module.exports = {
  embedText,
  cosineSim,
  semanticScore,
};
