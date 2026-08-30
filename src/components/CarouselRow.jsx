import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard, { MediaCardSkeleton } from './MediaCard';

function CarouselRow({ title, subtitle, items, loading, onOpen, onLike, onDetails, likedIds }) {
  const scrollerRef = useRef(null);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const scrollByCards = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = 280 * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  if (!loading && safeItems.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-paper font-semibold tracking-tight">{title}</div>
          {subtitle ? <div className="text-paper-dim/70 text-sm">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollByCards(-1)}
            className="h-9 w-9 rounded-full bg-ink-900 border border-ink-700 grid place-items-center text-paper-dim hover:text-paper hover:bg-ink-800"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollByCards(1)}
            className="h-9 w-9 rounded-full bg-ink-900 border border-ink-700 grid place-items-center text-paper-dim hover:text-paper hover:bg-ink-800"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <MediaCardSkeleton key={i} />)
          : safeItems.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onOpen={onOpen}
                onLike={onLike}
                onDetails={onDetails}
                liked={likedIds?.has(item.id)}
              />
            ))}
      </div>
    </section>
  );
}

export default CarouselRow;
