import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Sparkles, TrendingUp, Play, Music, Mic, Film, Newspaper, Library, Settings, Compass, BarChart3, Radio } from 'lucide-react';
import SpectrumBar from './SpectrumBar';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/for-you', label: 'For You', icon: Sparkles },
  { to: '/trending', label: 'Trending', icon: TrendingUp },
  { to: '/journeys', label: 'Journeys', icon: Compass },
  { to: '/domain/video', label: 'Videos', icon: Play },
  { to: '/domain/music', label: 'Music', icon: Music },
  { to: '/domain/podcast', label: 'Podcasts', icon: Mic },
  { to: '/domain/movie', label: 'Movies', icon: Film },
  { to: '/domain/news', label: 'News', icon: Newspaper },
  { to: '/library', label: 'My Library', icon: Library },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/profile', label: 'Settings', icon: Settings },
];

function Sidebar() {
  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-ink-900 border-r border-ink-700">
      <div className="h-16 flex items-center px-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-ink-800 border border-ink-600 grid place-items-center text-signal">
            <Radio className="h-4 w-4" />
          </div>
          <div className="font-display text-paper tracking-tight">OmniStream</div>
        </div>
      </div>

      <nav className="px-3 py-4 space-y-1 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-signal/10 text-signal' : 'text-paper-dim hover:text-paper hover:bg-ink-800',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-ink-700">
        <SpectrumBar className="mb-2" />
        <div className="text-[11px] text-paper-dim/70 font-mono">5 channels · 1 signal</div>
      </div>
    </aside>
  );
}

export default Sidebar;
