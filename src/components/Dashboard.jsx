import React, { useEffect, useMemo, useState } from 'react';
import CarouselRow from './CarouselRow';
import { likeItem, unlikeItem, openItem, trackEvent } from '../services/api';
import WhyModal from './WhyModal';

function Dashboard({ recommendations, loading, explore = 0, onExploreChange }) {
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [whyItem, setWhyItem] = useState(null);
  const [lastImpressionSig, setLastImpressionSig] = useState('');

  useEffect(() => {
    const next = new Set();
    for (const it of recommendations || []) {
      if (it?.liked) next.add(it.id);
    }
    setLikedIds(next);
  }, [recommendations]);

  useEffect(() => {
    if (!Array.isArray(recommendations) || recommendations.length === 0) return;
    const itemIds = recommendations.slice(0, 20).map((x) => x.id).filter(Boolean);
    const sig = itemIds.join('|');
    if (!sig || sig === lastImpressionSig) return;

    setLastImpressionSig(sig);
    (async () => {
      try {
        await trackEvent('impression', { itemIds, source: 'feed' });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to track impression:', e);
      }
    })();
  }, [recommendations, lastImpressionSig]);

  const onLike = async (item) => {
    const itemId = item?.id;
    if (!itemId) return;

    const wasLiked = likedIds.has(itemId);

    // Optimistic update
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

    try {
      if (wasLiked) await unlikeItem(itemId);
      else await likeItem(itemId);
    } catch (e) {
      // Revert on failure
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.add(itemId);
        else next.delete(itemId);
        return next;
      });
      // eslint-disable-next-line no-console
      console.error('Failed to update like:', e);
    }
  };

  const onOpen = async (item) => {
    if (!item?.id) return;
    try {
      await openItem(item.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to track open:', e);
    }
    if (item?.url) window.open(item.url, '_blank');
  };

  const grouped = useMemo(() => {
    const byDomain = { video: [], music: [], podcast: [], movie: [], news: [] };
    for (const it of recommendations || []) {
      if (byDomain[it.domain]) byDomain[it.domain].push(it);
    }
    return byDomain;
  }, [recommendations]);

  const topPicks = useMemo(() => (recommendations || []).slice(0, 10), [recommendations]);

  if (loading) {
    return (
      <div className="px-4 lg:px-6 py-10">
        <div className="h-9 w-80 rounded-full bg-white/5 border border-white/10 animate-pulse" />
        <div className="mt-8 h-[180px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        <div className="mt-8 h-[180px] rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6 space-y-8">
      <WhyModal open={Boolean(whyItem)} item={whyItem} onClose={() => setWhyItem(null)} />
      <div className="rounded-2xl p-4 bg-gradient-to-r from-indigo-600/25 via-fuchsia-600/15 to-pink-600/20 border border-white/10">
        <div className="text-center text-white/80 text-xs tracking-[0.18em] font-semibold">
          YOUR UNIFIED RECOMMENDATIONS
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold">Explore vs Familiar</div>
            <div className="text-white/60 text-sm">
              {explore < 0.34 ? 'More familiar' : explore < 0.67 ? 'Balanced' : 'More discovery'}
            </div>
          </div>
          <div className="flex items-center gap-3 w-full max-w-xs">
            <span className="text-xs text-white/50">Familiar</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={explore}
              onChange={(e) => onExploreChange?.(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-xs text-white/50">Explore</span>
          </div>
        </div>
      </div>

      <CarouselRow
        title="Top Cross-Domain Picks"
        subtitle="Personalized across video, music, podcasts, movies and news"
        items={topPicks}
        onOpen={onOpen}
        onLike={onLike}
        onWhy={setWhyItem}
        likedIds={likedIds}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CarouselRow
          title="New in Videos & Shows"
          items={grouped.video}
          onOpen={onOpen}
          onLike={onLike}
          onWhy={setWhyItem}
          likedIds={likedIds}
        />
        <CarouselRow
          title="Trending Music & Playlists"
          items={grouped.music}
          onOpen={onOpen}
          onLike={onLike}
          onWhy={setWhyItem}
          likedIds={likedIds}
        />
        <CarouselRow
          title="Recent News Articles"
          items={grouped.news}
          onOpen={onOpen}
          onLike={onLike}
          onWhy={setWhyItem}
          likedIds={likedIds}
        />
        <CarouselRow
          title="Popular Podcasts"
          items={grouped.podcast}
          onOpen={onOpen}
          onLike={onLike}
          onWhy={setWhyItem}
          likedIds={likedIds}
        />
      </div>
    </div>
  );
}

export default Dashboard;
