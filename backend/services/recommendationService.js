const { buildUserProfile, affinityForItem } = require('./userModelService');
const { embedText, cosineSim, semanticScore } = require('./embeddingService');
const { getContent } = require('./contentService');

const DOMAIN_KEYS = ['video', 'music', 'podcast', 'movie', 'news'];
const RECOMMENDATION_MODES = ['home', 'for-you', 'trending'];

function normalizeText(s) {
  return String(s || '').toLowerCase();
}

function rerankWithDiversity(items, explore = 0) {
  const e = Math.max(0, Math.min(1, Number(explore || 0)));
  if (!e) return items;

  const remaining = items.slice();
  const out = [];
  const topicCount = new Map();
  const domainCount = new Map();

  const getPenalty = (it) => {
    const t = it.topic || 'unknown';
    const d = it.domain || 'unknown';
    const tp = (topicCount.get(t) || 0) * 0.12;
    const dp = (domainCount.get(d) || 0) * 0.10;
    return (tp + dp) * e;
  };

  while (remaining.length) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i += 1) {
      const it = remaining[i];
      const base = typeof it.relevanceScore === 'number' ? it.relevanceScore : 0;
      const adjusted = base - getPenalty(it);
      if (adjusted > bestScore) {
        bestScore = adjusted;
        bestIdx = i;
      }
    }

    const [picked] = remaining.splice(bestIdx, 1);
    out.push(picked);
    topicCount.set(picked.topic || 'unknown', (topicCount.get(picked.topic || 'unknown') || 0) + 1);
    domainCount.set(picked.domain || 'unknown', (domainCount.get(picked.domain || 'unknown') || 0) + 1);
  }

  return out;
}

function parseCategories(cats) {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c) => normalizeText(c)).filter(Boolean);
  return String(cats)
    .split(',')
    .map((c) => normalizeText(c.trim()))
    .filter(Boolean);
}

function scoreItem(item, prefsForDomain, likedIds, interactionScore = 0) {
  // Deterministic scoring: based on tags/categories overlap + rating + recency.
  const categories = parseCategories(prefsForDomain?.categories);
  const tags = (item.tags || []).map(normalizeText);

  const overlap = categories.length
    ? tags.filter((t) => categories.includes(t)).length / Math.max(1, categories.length)
    : 0;

  const ratingScore = typeof item.rating === 'number' ? item.rating / 5 : 0.7;

  const created = item.createdAt ? Date.parse(item.createdAt) : Date.now();
  const ageDays = Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 1 - ageDays / 60);

  const interestBoost = prefsForDomain?.interested ? 0.15 : prefsForDomain?.neutral ? 0.05 : 0;
  const likedBoost = likedIds?.has(item.id) ? 0.1 : 0;

  // Cap interaction influence so it can't dominate everything
  const interactionBoost = Math.max(-0.2, Math.min(0.2, interactionScore / 20));

  return 0.45 * ratingScore + 0.35 * recencyScore + 0.2 * overlap + interestBoost + likedBoost + interactionBoost;
}

function getTrendingScore(item) {
  const popularity = typeof item.popularity === 'number' ? item.popularity : 0;
  const created = item.createdAt ? Date.parse(item.createdAt) : Date.now();
  const ageDays = Math.max(0, (Date.now() - created) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 1 - ageDays / 30);
  return popularity * 0.8 + recencyScore * 0.2;
}

function buildUserSemanticQuery(profile, analyticsEvents) {
  const topics = (profile?.summary?.topTopics || []).slice(0, 5).map((t) => t.key).filter(Boolean);
  const domains = (profile?.summary?.topDomains || []).slice(0, 3).map((d) => d.key).filter(Boolean);

  const recentSearches = (analyticsEvents || [])
    .slice()
    .reverse()
    .filter((e) => e?.event === 'search' && e?.data?.query)
    .slice(0, 3)
    .map((e) => String(e.data.query));

  const parts = [];
  if (topics.length) parts.push(`Interests: ${topics.join(', ')}`);
  if (domains.length) parts.push(`Preferred formats: ${domains.join(', ')}`);
  if (recentSearches.length) parts.push(`Recent searches: ${recentSearches.join(' | ')}`);

  return parts.join('. ');
}

function itemTextForEmbedding(item) {
  const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
  return `${item.title || ''}. ${item.description || ''}. ${item.topic || ''}. ${item.domain || ''}. ${item.mood || ''}. ${item.intent || ''}. ${tags}`;
}

async function getRecommendations({ domain, limit, mode, explore }, preferences, likedIds, interactionScores, analyticsEvents = []) {
  const lim = Math.min(Math.max(Number(limit || 20), 1), 100);
  const safeMode = RECOMMENDATION_MODES.includes(mode) ? mode : 'home';

  const all = await getContent();
  const pool = domain ? all.filter((c) => c.domain === domain) : all.slice();

  const profile = buildUserProfile({ preferences, analyticsEvents });

  const userQuery = buildUserSemanticQuery(profile, analyticsEvents);
  const userEmbedding = userQuery ? await embedText(userQuery) : null;

  const enriched = await Promise.all(pool.map(async (item) => {
    const prefsForDomain = preferences?.[item.domain] || {};
    const interactionScore = interactionScores?.get(item.id) || 0;

    const affinity = affinityForItem(profile, item);

    const itemEmbedding = userEmbedding ? await embedText(itemTextForEmbedding(item)) : null;
    const cos = userEmbedding && itemEmbedding ? cosineSim(userEmbedding, itemEmbedding) : 0;
    const semantic = semanticScore(cos);

    const explanation = {
      matchedTopics: item.topic ? [item.topic] : [],
      matchedDomain: item.domain,
      reasons: [],
    };

    if (affinity > 0.15 && item.topic) explanation.reasons.push(`Matches your interest in ${item.topic}`);
    if (prefsForDomain?.interested) explanation.reasons.push(`You set ${item.domain} as high interest`);
    if (interactionScore > 0) explanation.reasons.push('Based on your recent interactions');
    if (likedIds?.has(item.id)) explanation.reasons.push('You liked this');
    if (semantic > 0.72) explanation.reasons.push('Semantically similar to what you recently searched/read');
    else if (semantic > 0.62) explanation.reasons.push('Semantically similar to your inferred interests');

    return {
      ...item,
      affinityScore: affinity,
      semanticScore: semantic,
      relevanceScore: scoreItem(item, prefsForDomain, likedIds, interactionScore) + affinity * 0.25 + semantic * 0.35,
      trendingScore: getTrendingScore(item),
      liked: likedIds?.has(item.id) || false,
      explanation,
    };
  }));

  let ranked;
  if (safeMode === 'trending') {
    ranked = enriched.sort((a, b) => b.trendingScore - a.trendingScore);
  } else if (safeMode === 'for-you') {
    ranked = enriched.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } else {
    // home: blend personalization + trending
    ranked = enriched.sort((a, b) => (b.relevanceScore * 0.7 + b.trendingScore * 0.3) - (a.relevanceScore * 0.7 + a.trendingScore * 0.3));
  }

  ranked = rerankWithDiversity(ranked, explore);

  const scored = ranked.slice(0, lim);

  return scored;
}

async function searchContent({ q, domains, sortBy, limit }) {
  const query = normalizeText(q);
  const lim = Math.min(Math.max(Number(limit || 20), 1), 100);

  const all = await getContent();

  const domainSet = new Set(
    domains
      ? String(domains)
          .split(',')
          .map((d) => normalizeText(d.trim()))
          .filter(Boolean)
      : DOMAIN_KEYS
  );

  const results = all.filter((item) => {
    if (!domainSet.has(item.domain)) return false;
    if (!query) return true;
    const inTitle = normalizeText(item.title).includes(query);
    const inDesc = normalizeText(item.description).includes(query);
    const inTags = (item.tags || []).some((t) => normalizeText(t).includes(query));
    return inTitle || inDesc || inTags;
  });

  switch (sortBy) {
    case 'rating':
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case 'newest':
      results.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
      break;
    case 'oldest':
      results.sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));
      break;
    case 'popularity':
      results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      break;
    default:
      break;
  }

  return results.slice(0, lim);
}

module.exports = { DOMAIN_KEYS, RECOMMENDATION_MODES, getRecommendations, searchContent };
