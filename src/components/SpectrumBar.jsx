import React from 'react';

const CHANNELS = [
  { domain: 'movie', className: 'bg-domain-movie' },
  { domain: 'video', className: 'bg-domain-video' },
  { domain: 'music', className: 'bg-domain-music' },
  { domain: 'podcast', className: 'bg-domain-podcast' },
  { domain: 'news', className: 'bg-domain-news' },
];

/** The product's one recurring signature mark -- five channels, one signal. See docs/design.md. */
function SpectrumBar({ className = '' }) {
  return (
    <div className={['spectrum-bar', className].join(' ')} aria-hidden="true">
      {CHANNELS.map((c) => (
        <span key={c.domain} className={c.className} />
      ))}
    </div>
  );
}

export default SpectrumBar;
