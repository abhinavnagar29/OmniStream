'use strict';

/**
 * Greedy MMR-style diversity re-rank: at each step, pick the remaining item
 * that maximizes (relevance - lambda * redundancy), where redundancy grows
 * with how many items of the same topic/domain have already been picked.
 *
 * `explore` (0..1) plays the role of MMR's lambda: 0 = pure relevance order
 * (no diversity pressure), 1 = full diversity pressure. See
 * ml/evaluate.py for the offline relevance/diversity trade-off this was
 * tuned against, instead of picking the penalty constants by eye.
 */
function rerankWithDiversity(items, explore = 0) {
  const e = Math.max(0, Math.min(1, Number(explore || 0)));
  if (!e || items.length <= 1) return items;

  const remaining = items.slice();
  const out = [];
  const topicCount = new Map();
  const domainCount = new Map();

  const getPenalty = (it) => {
    const t = it.topic || 'unknown';
    const d = it.domain || 'unknown';
    const tp = (topicCount.get(t) || 0) * 0.12;
    const dp = (domainCount.get(d) || 0) * 0.1;
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

/** Catalog coverage / intra-list diversity, used by both the metrics route and ml/evaluate.py analogues. */
function diversityStats(items) {
  const topics = new Set(items.map((i) => i.topic).filter(Boolean));
  const domains = new Set(items.map((i) => i.domain).filter(Boolean));
  return {
    uniqueTopics: topics.size,
    uniqueDomains: domains.size,
    topicEntropy: entropy(items.map((i) => i.topic)),
  };
}

function entropy(labels) {
  const counts = new Map();
  for (const l of labels) counts.set(l, (counts.get(l) || 0) + 1);
  const n = labels.length || 1;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 1000) / 1000;
}

module.exports = { rerankWithDiversity, diversityStats };
