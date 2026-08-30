import React from 'react';
import { Heart, Play, Info } from 'lucide-react';

const badgeMap = {
  video: { label: 'Video', cls: 'bg-domain-video/15 text-domain-video border-domain-video/30' },
  music: { label: 'Music', cls: 'bg-domain-music/15 text-domain-music border-domain-music/30' },
  podcast: { label: 'Podcast', cls: 'bg-domain-podcast/15 text-domain-podcast border-domain-podcast/30' },
  movie: { label: 'Movie', cls: 'bg-domain-movie/15 text-domain-movie border-domain-movie/30' },
  news: { label: 'Article', cls: 'bg-domain-news/15 text-domain-news border-domain-news/30' },
};

export function MediaCardSkeleton() {
  return (
    <div className="w-[260px] shrink-0 rounded-2xl overflow-hidden bg-ink-900 border border-ink-700 animate-pulse">
      <div className="h-[150px] bg-ink-800" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-4/5 rounded bg-ink-800" />
        <div className="h-3 w-3/5 rounded bg-ink-800" />
      </div>
    </div>
  );
}

function MediaCard({ item, onOpen, onLike, onDetails, liked }) {
  const badge = badgeMap[item.domain] || { label: item.domain, cls: 'bg-ink-700 text-paper-dim border-ink-600' };

  return (
    <div className="group relative w-[260px] shrink-0 rounded-2xl overflow-hidden bg-ink-900 border border-ink-700 hover:border-ink-600 hover:bg-ink-800 transition-colors">
      <button
        onClick={() => onDetails?.(item)}
        className="relative h-[150px] w-full bg-ink-950 block text-left"
        aria-label={`View details for ${item.title}`}
      >
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={[
            'text-[11px] px-2 py-1 rounded-full border font-mono',
            badge.cls,
          ].join(' ')}>
            {badge.label}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 right-3 text-paper text-sm font-medium line-clamp-1 text-left">
          {item.title}
        </div>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onLike?.(item); }}
        className={[
          'absolute top-3 right-3 h-9 w-9 rounded-full border grid place-items-center transition-colors',
          liked ? 'bg-domain-video/20 border-domain-video/40 text-domain-video' : 'bg-ink-800/80 border-ink-600 text-paper-dim hover:text-paper hover:bg-ink-700',
        ].join(' ')}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <Heart className={["h-4 w-4", liked ? 'fill-current' : ''].join(' ')} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDetails?.(item); }}
        className="absolute top-3 right-14 h-9 w-9 rounded-full border border-ink-600 bg-ink-800/80 grid place-items-center text-paper-dim hover:text-paper hover:bg-ink-700 transition-colors"
        aria-label="Why this was recommended"
      >
        <Info className="h-4 w-4" />
      </button>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="text-paper-dim text-xs line-clamp-2 flex-1">{item.description}</div>
          <button
            onClick={() => onOpen?.(item)}
            className="h-8 px-3 rounded-full bg-signal text-ink-950 text-xs font-medium hover:bg-signal-bright transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {item.domain === 'news' ? 'Read' : 'Play'}
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-paper-dim/70 font-mono">
          <span>{item.source || 'Source'}</span>
          <span>{item.rating ? `★ ${item.rating}` : item.duration || ''}</span>
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
