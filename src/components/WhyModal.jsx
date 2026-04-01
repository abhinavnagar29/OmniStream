import React from 'react';
import { X } from 'lucide-react';

function WhyModal({ open, item, onClose }) {
  if (!open || !item) return null;

  const reasons = item.explanation?.reasons || [];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[#0B0F19] border border-white/10 shadow-2xl">
          <div className="flex items-start justify-between p-5 border-b border-white/10">
            <div>
              <div className="text-white font-semibold">Why this was recommended</div>
              <div className="text-white/60 text-sm mt-1 line-clamp-2">{item.title}</div>
            </div>
            <button
              onClick={onClose}
              className="h-9 w-9 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {reasons.length ? (
              <ul className="space-y-2">
                {reasons.map((r, idx) => (
                  <li key={idx} className="text-white/70 text-sm">
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-white/60 text-sm">No explanation available.</div>
            )}

            {item.explanation?.matchedTopics?.length ? (
              <div className="pt-3 border-t border-white/10">
                <div className="text-white/60 text-xs">Matched topics</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.explanation.matchedTopics.map((t) => (
                    <span key={t} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WhyModal;
