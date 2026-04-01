import React, { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MediaCard from './MediaCard';

function CarouselRow({ title, subtitle, items, onOpen, onLike, onWhy, likedIds }) {
  const scrollerRef = useRef(null);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const scrollByCards = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = 280 * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-white font-semibold tracking-tight">{title}</div>
          {subtitle ? <div className="text-white/50 text-sm">{subtitle}</div> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollByCards(-1)}
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollByCards(1)}
            className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white hover:bg-white/10"
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
        {safeItems.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onOpen={onOpen}
            onLike={onLike}
            onWhy={onWhy}
            liked={likedIds?.has(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default CarouselRow;
