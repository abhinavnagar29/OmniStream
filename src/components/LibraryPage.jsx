import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { getLibrary } from '../services/api';

function LibraryPage() {
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getLibrary();
        if (!cancelled) setLiked(data?.liked || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="px-4 lg:px-6 py-10">
        <div className="h-10 w-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
        <div className="mt-6 h-40 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
            <Heart className="h-5 w-5 text-rose-200" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">My Library</div>
            <div className="text-white/60 text-sm">Your liked items (persists once feedback endpoints are wired)</div>
          </div>
        </div>

        {liked.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
            <div className="text-white/70 font-medium">No liked items yet</div>
            <div className="text-white/50 text-sm mt-1">Like something on the dashboard to save it here.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {liked.map((item) => (
              <button
                key={item.id}
                onClick={() => item.url && window.open(item.url, '_blank')}
                className="text-left rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition p-4"
              >
                <div className="text-white font-semibold line-clamp-1">{item.title}</div>
                <div className="text-white/60 text-sm mt-1 line-clamp-2">{item.description}</div>
                <div className="mt-3 text-white/40 text-xs">{item.domain} • {item.source || 'Source'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LibraryPage;
