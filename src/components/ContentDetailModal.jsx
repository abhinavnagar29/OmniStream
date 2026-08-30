import React from 'react';
import { X, ExternalLink, Heart, Info } from 'lucide-react';

const domainLabel = {
  video: 'Video', music: 'Music', podcast: 'Podcast', movie: 'Movie', news: 'Article',
};

/**
 * Replaces the old behavior where clicking "Play"/"Read" on an item with no
 * external URL (true for most of the real TMDB movies in this dataset --
 * TMDB's `homepage` field is empty for the large majority of entries) did
 * nothing at all, with no feedback. Now every item opens something useful:
 * an external link when one exists, and this detail view (full description,
 * rating, tags, and the "why recommended" reasoning) either way.
 */
function ContentDetailModal({ open, item, liked, onClose, onLike, onOpenExternal }) {
  if (!open || !item) return null;

  const reasons = item.explanation?.reasons || [];
  const hasExternalLink = Boolean(item.url);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-ink-900 border border-ink-700 shadow-2xl">
          {item.thumbnail ? (
            <div className="relative h-40 bg-ink-950">
              <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/10 to-transparent" />
              <button
                onClick={onClose}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-ink-900/80 border border-ink-700 grid place-items-center text-paper-dim hover:text-paper"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          <div className="p-5">
            {!item.thumbnail ? (
              <div className="flex items-start justify-between mb-3">
                <span className="text-[11px] px-2 py-1 rounded-full border border-ink-600 bg-ink-800 text-paper-dim font-mono">
                  {domainLabel[item.domain] || item.domain}
                </span>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-full bg-ink-800 border border-ink-700 grid place-items-center text-paper-dim hover:text-paper"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <span className="text-[11px] px-2 py-1 rounded-full border border-ink-600 bg-ink-800 text-paper-dim font-mono">
                {domainLabel[item.domain] || item.domain}
              </span>
            )}

            <h2 className="font-display text-xl text-paper mt-3">{item.title}</h2>
            {item.description ? (
              <p className="text-paper-dim text-sm mt-2 leading-relaxed">{item.description}</p>
            ) : null}

            <div className="flex items-center gap-4 mt-4 text-xs text-paper-dim/70 font-mono">
              {item.rating ? <span>★ {item.rating}</span> : null}
              {item.duration ? <span>{item.duration}</span> : null}
              {item.source ? <span>{item.source}</span> : null}
            </div>

            {item.tags?.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.slice(0, 8).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-ink-800 border border-ink-700 text-paper-dim/80 text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}

            {reasons.length ? (
              <div className="mt-5 pt-4 border-t border-ink-700">
                <div className="flex items-center gap-1.5 text-paper-dim text-xs mb-2">
                  <Info className="h-3.5 w-3.5" />
                  Why this was recommended
                </div>
                <ul className="space-y-1.5">
                  {reasons.map((r, idx) => (
                    <li key={idx} className="text-paper-dim text-sm flex gap-2">
                      <span className="text-signal">·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 pt-4 border-t border-ink-700 flex items-center gap-2.5">
              <button
                onClick={() => onLike?.(item)}
                className={[
                  'flex-1 h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                  liked
                    ? 'bg-domain-video/15 border-domain-video/40 text-domain-video'
                    : 'bg-ink-800 border-ink-600 text-paper-dim hover:text-paper',
                ].join(' ')}
              >
                <Heart className={['h-4 w-4', liked ? 'fill-current' : ''].join(' ')} />
                {liked ? 'Liked' : 'Like'}
              </button>

              {hasExternalLink ? (
                <button
                  onClick={() => onOpenExternal?.(item)}
                  className="flex-1 h-10 rounded-lg bg-signal text-ink-950 text-sm font-medium hover:bg-signal-bright transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open source
                </button>
              ) : null}
            </div>

            {!hasExternalLink ? (
              <p className="text-paper-dim/50 text-[11px] mt-3 text-center">
                No external link available for this item.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContentDetailModal;
