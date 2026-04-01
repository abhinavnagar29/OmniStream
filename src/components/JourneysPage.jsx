import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { getJourneys } from '../services/api';

function JourneysPage() {
  const [loading, setLoading] = useState(true);
  const [journeys, setJourneys] = useState([]);

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
            <Sparkles className="h-5 w-5 text-indigo-200" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">Journeys</div>
            <div className="text-white/60 text-sm">Cross-domain bundles built from your interests</div>
          </div>
        </div>

        <div className="space-y-4">
          {journeys.map((j) => (
            <div key={j.id} className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="text-white font-semibold">{j.title}</div>
              <div className="text-white/60 text-sm mt-1">Topic: {j.topic}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {j.items.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => it.url && window.open(it.url, '_blank')}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-left"
                  >
                    <div className="text-white text-sm font-medium line-clamp-1">{it.title}</div>
                    <div className="text-white/50 text-xs mt-1">{it.domain} • {it.source}</div>
                  </button>
                ))}
              </div>
              {j.explanation?.reasons?.length ? (
                <div className="mt-4 text-white/50 text-xs">
                  {j.explanation.reasons.join(' • ')}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default JourneysPage;
