import { useCallback, useState } from 'react';
import { likeItem, unlikeItem, openItem, trackEvent } from '../services/api';
import { toast } from '../components/AppToaster';

/**
 * Every page that shows content (Dashboard, Library, Journeys, Search) needs
 * the exact same three behaviors: like/unlike with a toast and optimistic
 * UI, "open" that either launches the real external link or falls back to
 * the detail modal (see ContentDetailModal's docstring for why that
 * fallback matters), and tracking. Centralizing it here means every page
 * behaves identically instead of five slightly-different copies drifting
 * apart, and a bug fix here fixes it everywhere at once.
 */
export function useContentInteractions(initialLikedIds = []) {
  const [likedIds, setLikedIds] = useState(() => new Set(initialLikedIds));
  const [detailItem, setDetailItem] = useState(null);

  const toggleLike = useCallback(async (item) => {
    const alreadyLiked = likedIds.has(item.id);

    // Optimistic update -- the UI reflects the change immediately; roll
    // back only if the request actually fails.
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });

    try {
      if (alreadyLiked) {
        await unlikeItem(item.id);
        toast.success(`Removed "${item.title}" from your library`);
      } else {
        await likeItem(item.id);
        toast.success(`Saved "${item.title}" to your library`);
      }
    } catch (err) {
      // Roll back the optimistic update
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      toast.error(err?.response?.data?.error?.message || 'Could not update your library');
    }
  }, [likedIds]);

  const openContent = useCallback((item) => {
    openItem(item.id).catch(() => {}); // best-effort logging, never blocks the UI
    trackEvent('open_item', { itemId: item.id, domain: item.domain }).catch(() => {});

    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      // No external link for this item (true for most of the real movie
      // catalog) -- show the detail view instead of doing nothing.
      setDetailItem(item);
    }
  }, []);

  const showDetail = useCallback((item) => {
    setDetailItem(item);
  }, []);

  const closeDetail = useCallback(() => setDetailItem(null), []);

  return { likedIds, setLikedIds, toggleLike, openContent, showDetail, detailItem, closeDetail };
}
