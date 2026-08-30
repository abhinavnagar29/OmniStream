function hashToUnitFloat(str) {
  // Deterministic 32-bit FNV-1a
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Convert to [0,1)
  return ((h >>> 0) % 10000) / 10000;
}

function pick(arr, t) {
  return arr[Math.floor(t * arr.length) % arr.length];
}

const TOPIC_CLUSTERS = [
  {
    topic: 'ai',
    mood: 'informative',
    intent: 'learn',
    tags: ['ai', 'ml', 'technology', 'data'],
    keywords: ['AI', 'ML', 'Neural', 'Model'],
  },
  {
    topic: 'startups',
    mood: 'motivational',
    intent: 'learn',
    tags: ['startups', 'business', 'product', 'founders'],
    keywords: ['Startup', 'Founder', 'Pitch', 'Growth'],
  },
  {
    topic: 'sports',
    mood: 'exciting',
    intent: 'entertain',
    tags: ['sports', 'cricket', 'fitness', 'highlights'],
    keywords: ['Cricket', 'Highlights', 'Match', 'Pro'],
  },
  {
    topic: 'wellness',
    mood: 'relaxing',
    intent: 'relax',
    tags: ['wellness', 'meditation', 'sleep', 'mindfulness'],
    keywords: ['Calm', 'Meditation', 'Breath', 'Focus'],
  },
  {
    topic: 'space',
    mood: 'awe',
    intent: 'entertain',
    tags: ['space', 'science', 'sci-fi', 'astronomy'],
    keywords: ['Space', 'Cosmos', 'Orbit', 'Stars'],
  },
  {
    topic: 'finance',
    mood: 'informative',
    intent: 'stay_updated',
    tags: ['finance', 'economy', 'markets', 'investing'],
    keywords: ['Markets', 'Economy', 'Stocks', 'Rates'],
  },
];

const DOMAIN_SOURCES = {
  video: ['YouTube', 'Prime Video', 'TED'],
  music: ['Spotify', 'Apple Music', 'YouTube Music'],
  podcast: ['Spotify', 'Apple Podcasts', 'Pocket Casts'],
  movie: ['Netflix', 'Prime Video', 'Disney+'],
  news: ['NPR', 'BBC', 'Reuters'],
};

const DOMAIN_FORMATS = {
  video: ['short', 'medium', 'long'],
  music: ['single', 'album', 'playlist'],
  podcast: ['episode', 'series'],
  movie: ['feature'],
  news: ['article', 'brief'],
};

const LANGS = ['en', 'en', 'en', 'hi', 'es'];

function makeItem({ domain, cluster, idx }) {
  const id = `${domain[0]}_${cluster.topic}_${idx}`;
  const t = hashToUnitFloat(id);
  const t2 = hashToUnitFloat(`${id}_b`);
  const t3 = hashToUnitFloat(`${id}_c`);

  const keyword = pick(cluster.keywords, t);
  const source = pick(DOMAIN_SOURCES[domain], t2);
  const format = pick(DOMAIN_FORMATS[domain], t3);
  const language = pick(LANGS, t2);

  const popularity = Math.round(40 + 60 * t); // 40..100
  const rating = Math.round((3.8 + 1.2 * t2) * 10) / 10; // 3.8..5.0

  const daysAgo = Math.floor(1 + 240 * t3); // 1..240 days
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  const durations = {
    video: ['08:12', '12:44', '18:05', '24:36', '41:20'],
    music: ['2:48', '3:12', '3:55', '4:20'],
    podcast: ['28:10', '35:45', '49:12', '62:30'],
    movie: ['1:42:00', '2:05:00', '2:28:00', '2:49:00'],
    news: ['3 min read', '4 min read', '6 min read', '8 min read'],
  };

  const duration = pick(durations[domain], t);

  const titlePrefixes = {
    video: ['Explained:', 'Deep Dive:', 'Beginner Guide:', 'Masterclass:'],
    music: ['Soundscape:', 'Lo-fi:', 'Anthem:', 'Sessions:'],
    podcast: ['Episode:', 'Talk:', 'Stories:', 'Roundtable:'],
    movie: ['Feature:', 'Cinema:', 'Story:', 'Chronicles:'],
    news: ['Report:', 'Update:', 'Brief:', 'Analysis:'],
  };

  const title = `${pick(titlePrefixes[domain], t2)} ${keyword} & ${cluster.topic.toUpperCase()}`;
  const description = `A ${cluster.mood} ${domain} pick focused on ${cluster.topic}, designed to ${cluster.intent.replace('_', ' ')}.`;

  return {
    id,
    domain,
    title,
    description,
    thumbnail: `https://picsum.photos/seed/${encodeURIComponent(id)}/600/400.jpg`,
    url: `https://example.com/${domain}/${id}`,
    duration,
    rating,
    popularity,
    source,
    tags: Array.from(new Set([...cluster.tags, format, language])),
    topic: cluster.topic,
    mood: cluster.mood,
    intent: cluster.intent,
    format,
    language,
    createdAt,
  };
}

function generateContent() {
  const domains = ['video', 'music', 'podcast', 'movie', 'news'];
  const items = [];

  for (const domain of domains) {
    for (const cluster of TOPIC_CLUSTERS) {
      // 5 clusters * 6 domains * 5 each would be huge; we do 4 items per cluster per domain => 6*5*4 = 120
      for (let i = 1; i <= 4; i += 1) {
        items.push(makeItem({ domain, cluster, idx: i }));
      }
    }
  }

  return items;
}

const content = generateContent();

module.exports = { content };
