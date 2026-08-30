'use strict';

/**
 * Builds a lightweight implicit-feedback user profile: topic/domain/format/
 * language affinity vectors, time-decayed by recency, exactly like the
 * original in-memory version -- the only change is the input shape, which
 * now comes from `interactionRepo.recentForUser()` (a DB query already
 * JOINed against `content`, so each row carries topic/domain/format/tags)
 * instead of a raw in-process analytics array.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function incMap(map, key, delta) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + delta);
}

function normalizeWeights(map) {
  const entries = Array.from(map.entries());
  if (entries.length === 0) return new Map();
  const maxAbs = entries.reduce((m, [, v]) => Math.max(m, Math.abs(v)), 0) || 1;
  const out = new Map();
  for (const [k, v] of entries) out.set(k, v / maxAbs);
  return out;
}

function recencyMultiplier(atIso, halfLifeDays = 14) {
  const t = atIso instanceof Date ? atIso.getTime() : Date.parse(atIso || 0);
  if (!t) return 1;
  const ageDays = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
  return 0.5 ** (ageDays / halfLifeDays);
}

/**
 * @param {Array} interactionRows - rows from interactionRepo.recentForUser():
 *   { content_id, event_type, weight, created_at, domain, topic, tags, mood }
 * @param {Object} preferences - onboarding/explicit domain preferences
 */
function buildUserProfile({ interactionRows = [], preferences = {} } = {}) {
  const topic = new Map();
  const domain = new Map();
  const format = new Map();
  const language = new Map();

  for (const row of interactionRows) {
    if (!row.weight) continue;
    const recency = recencyMultiplier(row.created_at);
    const delta = row.weight * recency;

    incMap(topic, row.topic, delta);
    incMap(domain, row.domain, delta);
    if (row.format) incMap(format, row.format, delta);
    if (row.language) incMap(language, row.language, delta * 0.5);
  }

  for (const [d, prefs] of Object.entries(preferences || {})) {
    if (prefs?.interested) incMap(domain, d, 1.2);
    if (prefs?.neutral) incMap(domain, d, 0.6);
  }

  const normalized = {
    topic: normalizeWeights(topic),
    domain: normalizeWeights(domain),
    format: normalizeWeights(format),
    language: normalizeWeights(language),
  };

  const top = (m, n = 5) =>
    Array.from(m.entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, n)
      .map(([key, weight]) => ({ key, weight: Math.round(weight * 100) / 100 }));

  return {
    vectors: normalized,
    summary: {
      topTopics: top(normalized.topic),
      topDomains: top(normalized.domain),
      topFormats: top(normalized.format),
      topLanguages: top(normalized.language),
    },
    isColdStart: interactionRows.length === 0,
  };
}

function affinityForItem(profile, item) {
  const vt = profile?.vectors?.topic?.get(item.topic) || 0;
  const vd = profile?.vectors?.domain?.get(item.domain) || 0;
  const vf = profile?.vectors?.format?.get(item.format) || 0;
  const vl = profile?.vectors?.language?.get(item.language) || 0;

  return clamp(0.55 * vt + 0.25 * vd + 0.15 * vf + 0.05 * vl, -1, 1);
}

module.exports = { buildUserProfile, affinityForItem };
