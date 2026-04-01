const { getCachedContent } = require('./contentService');

const DOMAINS = ['video', 'podcast', 'news', 'movie', 'music'];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseMinutes(duration) {
  const s = String(duration || '').trim().toLowerCase();
  if (!s) return 10;

  const mRead = s.match(/(\d+)\s*min\s*read/);
  if (mRead) return clamp(Number(mRead[1]) || 5, 1, 240);

  const hms = s.split(':').map((x) => Number(x));
  if (hms.length === 3 && hms.every((x) => Number.isFinite(x))) {
    const [h, m, sec] = hms;
    return clamp(Math.round(h * 60 + m + (sec || 0) / 60), 1, 240);
  }
  if (hms.length === 2 && hms.every((x) => Number.isFinite(x))) {
    const [m, sec] = hms;
    return clamp(Math.round(m + (sec || 0) / 60), 1, 240);
  }

  const mOnly = s.match(/^(\d+)$/);
  if (mOnly) return clamp(Number(mOnly[1]) || 10, 1, 240);

  return 10;
}

function journeyTypeForTopic(topic) {
  switch (topic) {
    case 'wellness':
      return 'Relax';
    case 'finance':
      return 'Stay Updated';
    case 'sports':
      return 'Explore';
    default:
      return 'Learn';
  }
}

function stepLabelForDomain(domain) {
  switch (domain) {
    case 'video':
      return 'Start here';
    case 'podcast':
      return 'Deepen with this';
    case 'news':
      return 'Quick update';
    case 'movie':
      return 'Finish with this';
    case 'music':
      return 'Mood booster';
    default:
      return 'Next';
  }
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function pickTop(items, scoreFn, limit) {
  return items
    .slice()
    .sort((a, b) => scoreFn(b) - scoreFn(a))
    .slice(0, limit);
}

function createJourney({ topic, rankedItems, limit = 5 }) {
  const byDomain = groupBy(rankedItems.filter((x) => x.topic === topic), (x) => x.domain);

  const picks = [];
  for (const domain of DOMAINS) {
    const bucket = byDomain.get(domain) || [];
    if (bucket.length === 0) continue;
    picks.push(bucket[0]);
  }

  const items = picks.slice(0, limit);
  const steps = items.map((item, idx) => {
    const minutes = parseMinutes(item.duration);
    const label = stepLabelForDomain(item.domain);
    return {
      index: idx + 1,
      label,
      minutes,
      itemId: item.id,
    };
  });

  const totalMinutes = steps.reduce((s, x) => s + (x.minutes || 0), 0);
  const type = journeyTypeForTopic(topic);

  return {
    id: `journey_${topic}`,
    title: `${topic.toUpperCase()} Cross‑Domain Journey`,
    type,
    topic,
    totalMinutes,
    steps,
    items,
    explanation: {
      reasons: [
        `Built around your interest in ${topic}`,
        `Sequenced as a ${type.toLowerCase()} flow across formats`,
        'Includes multiple formats to support cross-domain discovery',
      ],
    },
  };
}

function generateJourneys(profile, recommendations, maxJourneys = 3) {
  const topTopics = profile?.summary?.topTopics || [];
  const topics = topTopics
    .filter((t) => t.weight > 0)
    .map((t) => t.key)
    .slice(0, maxJourneys);

  // fallback: trending topics by popularity
  if (topics.length === 0) {
    const content = getCachedContent();
    const byTopic = groupBy(content, (c) => c.topic);
    const scored = Array.from(byTopic.entries()).map(([topic, items]) => {
      const popularity = items.reduce((s, x) => s + (x.popularity || 0), 0) / Math.max(1, items.length);
      return { topic, popularity };
    });
    scored.sort((a, b) => b.popularity - a.popularity);
    topics.push(...scored.slice(0, maxJourneys).map((x) => x.topic));
  }

  const rankedItems = Array.isArray(recommendations) && recommendations.length ? recommendations : getCachedContent();

  const journeys = topics.map((topic) => createJourney({ topic, rankedItems }));

  // Ensure at least one journey
  if (journeys.length === 0) {
    journeys.push(createJourney({ topic: 'ai', rankedItems }));
  }

  return journeys;
}

module.exports = { generateJourneys, pickTop };
