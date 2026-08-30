import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Sparkles, Compass, Library, User } from 'lucide-react';

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/for-you', label: 'For You', icon: Sparkles },
  { to: '/journeys', label: 'Journeys', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/profile', label: 'Profile', icon: User },
];

/** Shown only below the `lg` breakpoint, where Sidebar.jsx is hidden. */
function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink-900/95 backdrop-blur border-t border-ink-700 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors',
                  isActive ? 'text-signal' : 'text-paper-dim',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileNav;
