import React from 'react';
import { Link } from 'react-router-dom';
import { Radio } from 'lucide-react';
import SpectrumBar from '../components/SpectrumBar';

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-ink-950 text-paper flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="h-12 w-12 rounded-full bg-ink-900 border border-ink-700 grid place-items-center text-signal mx-auto mb-6">
          <Radio className="h-5 w-5" />
        </div>
        <div className="font-display text-3xl text-paper mb-2">No signal here</div>
        <p className="text-paper-dim text-sm mb-8">This page doesn't exist, or the link's gone stale.</p>
        <SpectrumBar className="mb-8" />
        <Link
          to="/"
          className="inline-flex h-11 px-6 rounded-lg bg-signal text-ink-950 font-medium hover:bg-signal-bright transition-colors items-center justify-center"
        >
          Back to your feed
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
