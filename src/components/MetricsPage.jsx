import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getMetrics } from '../services/api';

function pct(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return `${Math.round(n * 100)}%`;
}

function num(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n * 100) / 100);
}

function JsonBlock({ value }) {
  return (
    <pre className="mt-2 text-xs text-white/50 whitespace-pre overflow-x-auto max-h-56 pr-2">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function sumCounts(obj) {
  return Object.values(obj || {}).reduce((s, x) => s + (Number(x) || 0), 0);
}

function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getMetrics();
        const isValid =
          data &&
          typeof data === 'object' &&
          typeof data.userId === 'string' &&
          data.dataset &&
          typeof data.dataset.totalItems === 'number';

        if (!isValid) {
          const preview = typeof data === 'string' ? data.slice(0, 180) : JSON.stringify(data).slice(0, 180);
          throw new Error(`Invalid metrics payload. If you see HTML here, the request is hitting the frontend instead of /api/metrics. Preview: ${preview}`);
        }

        if (!cancelled) setMetrics(data);
      } catch (e) {
        if (!cancelled) {
          setMetrics(null);
          setError(e?.message || String(e));
        }
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

  if (error) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-5xl mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 p-4 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (typeof metrics === 'string') {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="max-w-5xl mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 p-4 text-sm">
          Metrics API returned HTML/text. This usually means the backend is down or the proxy is misconfigured. Preview: {metrics.slice(0, 140)}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="px-4 lg:px-6 py-6">
        <div className="text-white/70">No metrics available.</div>
      </div>
    );
  }

  const totalEvents = sumCounts(metrics.engagementCounts);
  const showDebug = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
  const userBadge = String(metrics.userId || 'user').slice(0, 1).toUpperCase();

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center">
            <BarChart3 className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-white">Metrics</div>
            <div className="text-white/60 text-sm">Evidence of personalization and engagement</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-white font-semibold">
                  {userBadge}
                </div>
                <div>
                  <div className="text-white font-semibold">Active Profile</div>
                  <div className="text-white/60 text-sm">{metrics.userId}</div>
                </div>
              </div>
              <div className="text-xs text-white/50">Local demo user</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">liked</div>
                <div className="text-sm text-white font-semibold">{metrics.likedCount}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">events</div>
                <div className="text-sm text-white font-semibold">{totalEvents}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-white font-semibold">Dataset</div>
            <div className="text-white/60 text-sm mt-2">totalItems: {metrics.dataset.totalItems}</div>
            <div className="text-white/60 text-sm mt-3">domainCounts:</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(metrics.dataset.domainCounts || {}).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="text-xs text-white/60">{k}</div>
                  <div className="text-sm text-white font-semibold">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-white font-semibold">Recommender Quality</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">domain coverage (top {metrics.recommender?.topN ?? '—'})</div>
                <div className="text-sm text-white font-semibold">{pct(metrics.recommender?.domainCoverage)}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">diversity</div>
                <div className="text-sm text-white font-semibold">{num(metrics.recommender?.diversity)}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">novelty</div>
                <div className="text-sm text-white font-semibold">{pct(metrics.recommender?.novelty)}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">personalization confidence</div>
                <div className="text-sm text-white font-semibold">{pct(metrics.recommender?.personalizationConfidence)}</div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 col-span-2">
                <div className="text-xs text-white/60">explanation coverage</div>
                <div className="text-sm text-white font-semibold">{pct(metrics.recommender?.explanationCoverage)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-white font-semibold">Profile Summary</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">topTopics</div>
                <div className="text-sm text-white/80">
                  {(metrics.profileSummary?.topTopics || []).slice(0, 5).map((t) => t.key).filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">topDomains</div>
                <div className="text-sm text-white/80">
                  {(metrics.profileSummary?.topDomains || []).slice(0, 5).map((t) => t.key).filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">topFormats</div>
                <div className="text-sm text-white/80">
                  {(metrics.profileSummary?.topFormats || []).slice(0, 5).map((t) => t.key).filter(Boolean).join(', ') || '—'}
                </div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                <div className="text-xs text-white/60">topLanguages</div>
                <div className="text-sm text-white/80">
                  {(metrics.profileSummary?.topLanguages || []).slice(0, 5).map((t) => t.key).filter(Boolean).join(', ') || '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
            <div className="text-white font-semibold">Trending</div>
            <div className="text-white/60 text-sm mt-2">Top topics</div>
            <div className="mt-2 space-y-2">
              {(metrics.trending?.topTopics || []).slice(0, 5).map((t) => (
                <div key={t.topic} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="text-sm text-white/80">{t.topic}</div>
                  <div className="text-xs text-white/60">{t.count}</div>
                </div>
              ))}
            </div>
            <div className="text-white/60 text-sm mt-4">Top items</div>
            <div className="mt-2 space-y-2">
              {(metrics.trending?.topItems || []).slice(0, 5).map((x) => (
                <div key={x.id} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="text-sm text-white/80 line-clamp-1">{x.title}</div>
                  <div className="text-xs text-white/60 mt-1">
                    {x.domain} • {x.topic} • popularity {x.popularity ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 xl:col-span-2">
            <div className="text-white font-semibold">Engagement Counts</div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(metrics.engagementCounts || {}).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                  <div className="text-xs text-white/60">{k}</div>
                  <div className="text-sm text-white font-semibold">{v}</div>
                </div>
              ))}
              {Object.keys(metrics.engagementCounts || {}).length === 0 ? (
                <div className="text-white/60 text-sm">No engagement events yet.</div>
              ) : null}
            </div>
          </div>

          {showDebug ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5 xl:col-span-2">
              <details>
                <summary className="cursor-pointer select-none text-white font-semibold">Developer details</summary>
                <div className="text-white/60 text-sm mt-2">
                  Full metrics payload (for debugging). Not shown in production builds.
                </div>
                <JsonBlock value={metrics} />
              </details>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MetricsPage;
