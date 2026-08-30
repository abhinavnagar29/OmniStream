import React, { useEffect, useMemo, useState } from 'react';
import CarouselRow from './CarouselRow';
import SpectrumBar from './SpectrumBar';
import ContentDetailModal from './ContentDetailModal';
import { trackEvent } from '../services/api';
import { useContentInteractions } from '../hooks/useContentInteractions';

const DOMAIN_FILTERS = [
  { key: 'all', label: 'All', dot: null },
  { key: 'movie', label: 'Movies', dot: 'bg-domain-movie' },
  { key: 'video', label: 'Video', dot: 'bg-domain-video' },
  { key: 'music', label: 'Music', dot: 'bg-domain-music' },
  { key: 'podcast', label: 'Podcasts', dot: 'bg-domain-podcast' },
  { key: 'news', label: 'News', dot: 'bg-domain-news' },
];

function Dashboard({ recommendations, loading, explore = 0, onExploreChange }) {
  const [domainFilter, setDomainFilter] = useState('all');
  const [lastImpressionSig, setLastImpressionSig] = useState('');

  const initiallyLiked = useMemo(
    () => (recommendations || []).filter((it) => it?.liked).map((it) => it.id),
    // Only recompute the seed set when the underlying list identity changes,
    // not on every render -- see the effect below for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const { likedIds, setLikedIds, toggleLike, openContent, showDetail, detailItem, closeDetail } =
    useContentInteractions(initiallyLiked);

  useEffect(() => {
    const next = new Set();
    for (const it of recommendations || []) {
      if (it?.liked) next.add(it.id);
    }
    setLikedIds((prev) => {
      // Merge rather than replace -- a like the user just made client-side
      // shouldn't flicker off because the server payload hasn't caught up.
      const merged = new Set(prev);
      for (const id of next) merged.add(id);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendations]);

  useEffect(() => {
    if (!Array.isArray(recommendations) || recommendations.length === 0) return;
    const itemIds = recommendations.slice(0, 20).map((x) => x.id).filter(Boolean);
    const sig = itemIds.join('|');
    if (!sig || sig === lastImpressionSig) return;

    setLastImpressionSig(sig);
    trackEvent('impression', { itemIds, source: 'feed' }).catch(() => {});
  }, [recommendations, lastImpressionSig]);

  const filtered = useMemo(() => {
    if (domainFilter === 'all') return recommendations || [];
    return (recommendations || []).filter((it) => it.domain === domainFilter);
  }, [recommendations, domainFilter]);

  const grouped = useMemo(() => {
    const byDomain = { video: [], music: [], podcast: [], movie: [], news: [] };
    for (const it of filtered) {
      if (byDomain[it.domain]) byDomain[it.domain].push(it);
    }
    return byDomain;
  }, [filtered]);

  const topPicks = useMemo(() => filtered.slice(0, 10), [filtered]);

  if (loading) {
    return (
      <div className="px-4 lg:px-6 py-10">
        <div className="h-9 w-80 rounded-full bg-ink-900 border border-ink-700 animate-pulse" />
        <div className="mt-8 h-[180px] rounded-2xl bg-ink-900 border border-ink-700 animate-pulse" />
        <div className="mt-8 h-[180px] rounded-2xl bg-ink-900 border border-ink-700 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-8 pb-20 lg:pb-6">
      <ContentDetailModal
        open={Boolean(detailItem)}
        item={detailItem}
        liked={detailItem ? likedIds.has(detailItem.id) : false}
        onClose={closeDetail}
        onLike={toggleLike}
        onOpenExternal={(item) => window.open(item.url, '_blank', 'noopener,noreferrer')}
      />

      <div className="rounded-2xl bg-ink-900 border border-ink-700 overflow-hidden">
        <SpectrumBar />
        <div className="px-5 py-4">
          <div className="font-display text-xl text-paper">Your signal, tuned</div>
          <div className="text-paper-dim text-sm mt-0.5">One ranking, five channels — video, music, podcasts, movies and news.</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {DOMAIN_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDomainFilter(f.key)}
            className={[
              'h-9 px-3.5 rounded-full border text-sm flex items-center gap-2 transition-colors',
              domainFilter === f.key
                ? 'bg-signal/15 border-signal/40 text-signal'
                : 'bg-ink-900 border-ink-700 text-paper-dim hover:text-paper hover:border-ink-600',
            ].join(' ')}
          >
            {f.dot ? <span className={['h-1.5 w-1.5 rounded-full', f.dot].join(' ')} /> : null}
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-ink-900 border border-ink-700 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-paper font-semibold">Explore vs Familiar</div>
            <div className="text-paper-dim text-sm">
              {explore < 0.34 ? 'More familiar' : explore < 0.67 ? 'Balanced' : 'More discovery'}
            </div>
          </div>
          <div className="flex items-center gap-3 w-full max-w-xs">
            <span className="text-xs text-paper-dim/70">Familiar</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={explore}
              onChange={(e) => onExploreChange?.(Number(e.target.value))}
              className="w-full accent-signal"
            />
            <span className="text-xs text-paper-dim/70">Explore</span>
          </div>
        </div>
      </div>

      {topPicks.length === 0 && domainFilter !== 'all' ? (
        <div className="rounded-2xl bg-ink-900 border border-ink-700 p-8 text-center">
          <div className="text-paper-dim font-medium">Nothing here yet in {DOMAIN_FILTERS.find((f) => f.key === domainFilter)?.label}</div>
          <div className="text-paper-dim/70 text-sm mt-1">Try a different channel, or check back after liking a few things.</div>
        </div>
      ) : (
        <>
          <CarouselRow
            title="Top Cross-Domain Picks"
            subtitle="Personalized across video, music, podcasts, movies and news"
            items={topPicks}
            onOpen={openContent}
            onLike={toggleLike}
            onDetails={showDetail}
            likedIds={likedIds}
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <CarouselRow title="New in Videos & Shows" items={grouped.video} onOpen={openContent} onLike={toggleLike} onDetails={showDetail} likedIds={likedIds} />
            <CarouselRow title="Trending Music & Playlists" items={grouped.music} onOpen={openContent} onLike={toggleLike} onDetails={showDetail} likedIds={likedIds} />
            <CarouselRow title="Recent News Articles" items={grouped.news} onOpen={openContent} onLike={toggleLike} onDetails={showDetail} likedIds={likedIds} />
            <CarouselRow title="Popular Podcasts" items={grouped.podcast} onOpen={openContent} onLike={toggleLike} onDetails={showDetail} likedIds={likedIds} />
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
