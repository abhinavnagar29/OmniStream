import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getJourneys } from '../services/api';
import { useContentInteractions } from '../hooks/useContentInteractions';
import MediaCard, { MediaCardSkeleton } from './MediaCard';
import ContentDetailModal from './ContentDetailModal';
import SpectrumBar from './SpectrumBar';

function JourneysPage() {
  const [loading, setLoading] = useState(true);
  const [journeys, setJourneys] = useState([]);
  const { likedIds, toggleLike, openContent, showDetail, detailItem, closeDetail } = useContentInteractions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getJourneys();
        if (!cancelled) setJourneys(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-4 lg:px-6 py-6 pb-20 lg:pb-6">
      <ContentDetailModal
        open={Boolean(detailItem)}
        item={detailItem}
        liked={detailItem ? likedIds.has(detailItem.id) : false}
        onClose={closeDetail}
        onLike={toggleLike}
        onOpenExternal={(item) => window.open(item.url, '_blank', 'noopener,noreferrer')}
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-ink-900 border border-ink-700 grid place-items-center">
            <Sparkles className="h-5 w-5 text-signal" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-paper">Journeys</div>
            <div className="text-paper-dim text-sm">Cross-domain bundles built from your interests</div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-ink-900 border border-ink-700 p-5 animate-pulse">
                <div className="h-5 w-48 rounded bg-ink-800 mb-4" />
                <div className="flex gap-4">
                  <MediaCardSkeleton />
                  <MediaCardSkeleton />
                </div>
              </div>
            ))}
          </div>
        ) : journeys.length === 0 ? (
          <div className="rounded-2xl bg-ink-900 border border-ink-700 p-8 text-center">
            <div className="text-paper-dim font-medium">No journeys yet</div>
            <div className="text-paper-dim/70 text-sm mt-1">Like a few things across different channels and check back.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {journeys.map((j) => (
              <div key={j.id} className="rounded-2xl bg-ink-900 border border-ink-700 overflow-hidden">
                <SpectrumBar />
                <div className="p-5">
                  <div className="text-paper font-semibold text-lg font-display">{j.title}</div>
                  <div className="text-paper-dim text-sm mt-0.5">Topic: {j.topic}</div>

                  <div className="mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {j.items.map((it) => (
                      <MediaCard
                        key={it.id}
                        item={it}
                        onOpen={openContent}
                        onLike={toggleLike}
                        onDetails={showDetail}
                        liked={likedIds.has(it.id)}
                      />
                    ))}
                  </div>

                  {j.explanation?.reasons?.length ? (
                    <div className="mt-4 pt-4 border-t border-ink-700 text-paper-dim/70 text-xs">
                      {j.explanation.reasons.join(' · ')}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default JourneysPage;
