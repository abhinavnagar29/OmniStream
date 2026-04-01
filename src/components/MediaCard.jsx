import React from 'react';
import { Heart, Play, HelpCircle } from 'lucide-react';

const badgeMap = {
  video: { label: 'Video', cls: 'bg-red-500/20 text-red-200 border-red-500/30' },
  music: { label: 'Music', cls: 'bg-pink-500/20 text-pink-200 border-pink-500/30' },
  podcast: { label: 'Podcast', cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30' },
  movie: { label: 'Movie', cls: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/30' },
  news: { label: 'Article', cls: 'bg-amber-500/20 text-amber-200 border-amber-500/30' },
};

function MediaCard({ item, onOpen, onLike, onWhy, liked }) {
  const badge = badgeMap[item.domain] || { label: item.domain, cls: 'bg-white/10 text-white/80 border-white/10' };

  return (
    <div className="group relative w-[260px] shrink-0 rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition">
      <div className="relative h-[150px] bg-black/30">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={[
            'text-[11px] px-2 py-1 rounded-full border',
            badge.cls,
          ].join(' ')}>
            {badge.label}
          </span>
        </div>

        <button
          onClick={() => onLike?.(item)}
          className={[
            'absolute top-3 right-3 h-9 w-9 rounded-full border grid place-items-center transition',
            liked ? 'bg-rose-500/25 border-rose-500/30 text-rose-200' : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10',
          ].join(' ')}
          aria-label="Like"
        >
          <Heart className={["h-4 w-4", liked ? 'fill-current' : ''].join(' ')} />
        </button>

        <button
          onClick={() => onWhy?.(item)}
          className="absolute top-3 right-14 h-9 w-9 rounded-full border border-white/10 bg-white/5 grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition"
          aria-label="Why this?"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="text-white/90 text-sm font-medium line-clamp-1">{item.title}</div>
          <button
            onClick={() => onOpen?.(item)}
            className="h-9 px-3 rounded-full bg-white/10 border border-white/10 text-white text-sm hover:bg-white/20 transition flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            {item.domain === 'news' ? 'Read' : 'Play'}
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="text-white/60 text-xs line-clamp-2">{item.description}</div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-white/50">
          <span>{item.source || 'Source'}</span>
          <span>{item.rating ? `Rating ${item.rating}` : item.duration || ''}</span>
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
