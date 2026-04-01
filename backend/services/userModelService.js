const { getCachedContent } = require('./contentService');

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function incMap(map, key, delta) {
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

function getItemById(itemId) {
  const content = getCachedContent();
  return content.find((c) => c.id === itemId);
}

function getEventWeight(eventType) {
  switch (eventType) {
    case 'like':
      return 3;
    case 'open':
      return 1;
    case 'impression':
      return 0.15;
    case 'skip':
      return -2;
    case 'unlike':
      return -3;
    case 'search':
      return 0.4;
    default:
      return 0;
  }
}

function recencyMultiplier(atIso, halfLifeDays = 14) {
  const t = Date.parse(atIso || 0);
  if (!t) return 1;
  const ageDays = Math.max(0, (Date.now() - t) / (1000 * 60 * 60 * 24));
  // exponential decay: 0.5 at halfLife
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function buildUserProfile({ preferences, analyticsEvents }) {
  const topic = new Map();
  const domain = new Map();
  const format = new Map();
  const language = new Map();

  for (const ev of analyticsEvents || []) {
    const w = getEventWeight(ev.event);
    if (!w) continue;

    const recency = recencyMultiplier(ev.at);
    const delta = w * recency;

    if (ev.event === 'search') {
      const topTopics = Array.isArray(ev.data?.topTopics) ? ev.data.topTopics : [];
      for (const t of topTopics) {
        const key = t?.topic;
        if (!key) continue;
        const count = typeof t.count === 'number' ? t.count : 1;
        incMap(topic, key, delta * Math.min(3, Math.max(1, count)) * 0.35);
      }
      continue;
    }

    const itemIds = [];
    if (ev.data?.itemId) itemIds.push(ev.data.itemId);
    if (Array.isArray(ev.data?.itemIds)) itemIds.push(...ev.data.itemIds);
    if (itemIds.length === 0) continue;

    for (const itemId of itemIds) {
      const item = getItemById(itemId);
      if (!item) continue;

      if (item.topic) incMap(topic, item.topic, delta);
      if (item.domain) incMap(domain, item.domain, delta);
      if (item.format) incMap(format, item.format, delta);
      if (item.language) incMap(language, item.language, delta * 0.5);
    }
  }

  // Explicit preferences: treat categories as weak topic hints
  // If a user marks a domain interested/neutral, give domain prior.
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
  };
}

function affinityForItem(profile, item) {
  const vt = profile?.vectors?.topic?.get(item.topic) || 0;
  const vd = profile?.vectors?.domain?.get(item.domain) || 0;
  const vf = profile?.vectors?.format?.get(item.format) || 0;
  const vl = profile?.vectors?.language?.get(item.language) || 0;

  // bounded affinity [-1..1]
  return clamp(0.55 * vt + 0.25 * vd + 0.15 * vf + 0.05 * vl, -1, 1);
}

module.exports = { buildUserProfile, affinityForItem };
