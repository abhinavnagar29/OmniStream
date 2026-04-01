'use strict';

const https = require('node:https');
const crypto = require('node:crypto');

const { content: fallbackContent } = require('../data/content');

const DEFAULT_TTL_MS = 30 * 60 * 1000;

const FEEDS = [
  { name: 'Reuters Technology', url: 'https://feeds.reuters.com/reuters/technologyNews', domain: 'news' },
  { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', domain: 'news' },
  { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', domain: 'news' },
];

const APPLE_CHARTS = [
  {
    name: 'Apple Podcasts Top',
    url: 'https://rss.applemarketingtools.com/api/v2/us/podcasts/top/50/podcasts.json',
    domain: 'podcast',
  },
  {
    name: 'Apple Music Most Played Songs',
    url: 'https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/songs.json',
    domain: 'music',
  },
  {
    name: 'Apple Movies Top',
    url: 'https://rss.applemarketingtools.com/api/v2/us/movies/top-movies/50/movies.json',
    domain: 'movie',
  },
];

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'user-agent': 'hackathon-reco-bot/1.0' } }, (res) => {
      if (!res || (res.statusCode && res.statusCode >= 400)) {
        reject(new Error(`HTTP ${res?.statusCode || 'ERR'} for ${url}`));
        return;
      }
      res.setEncoding('utf8');
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function fetchJson(url) {
  const txt = await fetchUrl(url);
  return JSON.parse(txt);
}

function normalizeText(s) {
  return String(s || '').trim();
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s || '')).digest('hex');
}

function inferTopic(text) {
  const t = String(text || '').toLowerCase();
  if (/(ai|artificial intelligence|machine learning|llm|chatgpt|openai|model)/.test(t)) return 'ai';
  if (/(startup|founder|venture|vc|funding|product|entrepreneur)/.test(t)) return 'startups';
  if (/(cricket|football|nba|fifa|olympic|tennis|match|league)/.test(t)) return 'sports';
  if (/(wellness|meditation|mindfulness|sleep|health|yoga)/.test(t)) return 'wellness';
  if (/(space|nasa|rocket|mars|moon|satellite|astronomy)/.test(t)) return 'space';
  if (/(finance|market|stocks|inflation|rates|economy|bank)/.test(t)) return 'finance';
  return 'general';
}

function inferIntent(topic) {
  switch (topic) {
    case 'wellness':
      return 'relax';
    case 'finance':
      return 'stay_updated';
    case 'general':
      return 'stay_updated';
    default:
      return 'learn';
  }
}

function safeDateIso(d) {
  const t = Date.parse(d || '');
  if (!t) return new Date().toISOString();
  return new Date(t).toISOString();
}

function toRssItem({ feedName, domain }, raw) {
  const title = normalizeText(raw.title);
  const link = normalizeText(raw.link);
  const description = normalizeText(raw.description || raw.summary || raw['content:encoded']);

  const base = `${feedName}|${title}|${link}`;
  const id = `rss_${sha1(base).slice(0, 12)}`;

  const topic = inferTopic(`${title} ${description}`);
  const intent = inferIntent(topic);

  return {
    id,
    domain: domain || 'news',
    title: title || 'Untitled',
    description: description || '',
    thumbnail: 'https://picsum.photos/seed/rss/600/400.jpg',
    url: link || '',
    duration: '3 min read',
    rating: 4.3,
    popularity: 65,
    source: feedName,
    tags: [topic, 'rss', 'real'],
    topic,
    mood: intent === 'relax' ? 'relaxing' : 'informative',
    intent,
    format: 'article',
    language: 'en',
    createdAt: safeDateIso(raw.pubDate || raw.published || raw.isoDate || raw.updated),
  };
}

function toAppleItem({ sourceName, domain }, raw, rank) {
  const title = normalizeText(raw?.name);
  const description = normalizeText(raw?.artistName || raw?.kind || '');
  const url = normalizeText(raw?.url);
  const artwork = normalizeText(raw?.artworkUrl100 || raw?.artworkUrl60 || raw?.artworkUrl30);

  const base = `${sourceName}|${domain}|${title}|${url}`;
  const id = `apple_${sha1(base).slice(0, 12)}`;

  const topic = inferTopic(`${title} ${description}`);
  const intent = inferIntent(topic);

  const popularity = typeof rank === 'number' ? Math.max(1, Math.round(100 - rank * 1.5)) : 70;

  const formatByDomain = {
    podcast: 'episode',
    music: 'single',
    movie: 'feature',
  };

  return {
    id,
    domain,
    title: title || 'Untitled',
    description,
    thumbnail: artwork || `https://picsum.photos/seed/${encodeURIComponent(id)}/600/400.jpg`,
    url: url || '',
    duration: domain === 'music' ? '3:30' : domain === 'podcast' ? '35:00' : '1:50:00',
    rating: 4.4,
    popularity,
    source: sourceName,
    tags: [topic, 'apple', 'real'],
    topic,
    mood: intent === 'relax' ? 'relaxing' : 'informative',
    intent,
    format: formatByDomain[domain] || 'item',
    language: 'en',
    createdAt: new Date().toISOString(),
  };
}

function parseRss(xml) {
  let XMLParser;
  try {
    // eslint-disable-next-line global-require
    ({ XMLParser } = require('fast-xml-parser'));
  } catch (_) {
    return [];
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
  });
  const doc = parser.parse(xml);

  const channel = doc?.rss?.channel || doc?.feed;
  if (!channel) return [];

  let items = channel.item || channel.entry || [];
  if (!Array.isArray(items)) items = [items];

  return items;
}

const state = {
  cachedAt: 0,
  items: null,
};

function getCachedContent() {
  if (process.env.NODE_ENV === 'test') return fallbackContent;
  return state.items || fallbackContent;
}

async function ingestRssItems() {
  const results = [];
  for (const feed of FEEDS) {
    try {
      const xml = await fetchUrl(feed.url);
      const rawItems = parseRss(xml).slice(0, 15);
      for (const raw of rawItems) results.push(toRssItem(feed, raw));
    } catch (_) {
      // ignore per-feed failures
    }
  }

  const uniq = new Map();
  for (const it of results) {
    if (!it?.id) continue;
    if (!uniq.has(it.id)) uniq.set(it.id, it);
  }
  return Array.from(uniq.values());
}

async function ingestAppleCharts() {
  const results = [];
  for (const feed of APPLE_CHARTS) {
    try {
      const json = await fetchJson(feed.url);
      const rawItems = json?.feed?.results;
      if (!Array.isArray(rawItems)) continue;
      for (let i = 0; i < rawItems.length; i += 1) {
        results.push(toAppleItem({ sourceName: feed.name, domain: feed.domain }, rawItems[i], i + 1));
      }
    } catch (_) {
      // ignore per-feed failures
    }
  }

  const uniq = new Map();
  for (const it of results) {
    if (!it?.id) continue;
    if (!uniq.has(it.id)) uniq.set(it.id, it);
  }
  return Array.from(uniq.values());
}

async function getContent({ forceRefresh = false } = {}) {
  if (process.env.NODE_ENV === 'test') return fallbackContent;

  const ttlMs = Number(process.env.CONTENT_TTL_MS || DEFAULT_TTL_MS);
  const now = Date.now();
  const fresh = state.items && (now - state.cachedAt) < ttlMs;
  if (!forceRefresh && fresh) return state.items;

  const useReal = String(process.env.USE_REAL_CONTENT || '1') !== '0';
  let rss = [];
  let apple = [];
  if (useReal) {
    rss = await ingestRssItems();
    apple = await ingestAppleCharts();
  }

  const merged = fallbackContent.concat(rss).concat(apple);
  state.items = merged;
  state.cachedAt = now;
  return merged;
}

module.exports = {
  getContent,
  getCachedContent,
  FEEDS,
  APPLE_CHARTS,
};
