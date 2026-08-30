import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { getLibrary } from '../services/api';
import { useContentInteractions } from '../hooks/useContentInteractions';
import MediaCard, { MediaCardSkeleton } from './MediaCard';
import ContentDetailModal from './ContentDetailModal';

function LibraryPage() {
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState([]);
  const { likedIds, setLikedIds, toggleLike, openContent, showDetail, detailItem, closeDetail } =
    useContentInteractions();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getLibrary();
        if (!cancelled) {
          const items = data?.liked || [];
          setLiked(items);
          setLikedIds(new Set(items.map((i) => i.id)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When something gets unliked from within the library, drop it from the
  // visible list too instead of leaving a "liked" item that says it isn't.
  useEffect(() => {
    setLiked((prev) => prev.filter((item) => likedIds.has(item.id)));
  }, [likedIds]);

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

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-ink-900 border border-ink-700 grid place-items-center">
            <Heart className="h-5 w-5 text-domain-video" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-paper">My Library</div>
            <div className="text-paper-dim text-sm">Everything you've liked, saved for later</div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 6 }).map((_, i) => <MediaCardSkeleton key={i} />)}
          </div>
        ) : liked.length === 0 ? (
          <div className="rounded-2xl bg-ink-900 border border-ink-700 p-8 text-center">
            <div className="text-paper-dim font-medium">No liked items yet</div>
            <div className="text-paper-dim/70 text-sm mt-1">Like something from your feed to save it here.</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {liked.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onOpen={openContent}
                onLike={toggleLike}
                onDetails={showDetail}
                liked={likedIds.has(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LibraryPage;
