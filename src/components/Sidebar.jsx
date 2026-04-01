import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Sparkles, TrendingUp, Play, Music, Mic, Film, Newspaper, Library, Settings, Compass, BarChart3 } from 'lucide-react';

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
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-[#0B0F19] border-r border-white/10">
      <div className="h-16 flex items-center px-5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-pink-500" />
          <div className="text-white font-semibold tracking-tight">OmniStream</div>
        </div>
      </div>

      <nav className="px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white hover:bg-white/5',
                ].join(' ')
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
