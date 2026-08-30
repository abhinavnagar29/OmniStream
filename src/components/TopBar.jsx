import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function TopBar({ onSearch }) {
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initial = (user?.display_name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-ink-900/70 backdrop-blur border-b border-ink-700 sticky top-0 z-40">
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-paper-dim" />
          <input
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              setQ(next);
              onSearch?.(next);
            }}
            placeholder="Search videos, music, podcasts, movies, news..."
            className="w-full h-10 pl-10 pr-3 rounded-full bg-ink-800 border border-ink-600 text-paper placeholder:text-paper-dim/60 focus:outline-none focus:border-signal transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pl-4">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-full bg-ink-800 border border-ink-600 text-paper-dim hover:text-paper hover:border-ink-500 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-signal/20 border border-signal/40 text-signal grid place-items-center text-xs font-medium">
              {initial}
            </div>
            <span className="text-sm max-w-[140px] truncate">{user?.display_name || user?.email}</span>
          </button>

          {menuOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-ink-800 border border-ink-600 shadow-xl overflow-hidden py-1">
              <div className="px-3.5 py-2.5 border-b border-ink-700">
                <div className="text-sm text-paper truncate">{user?.display_name || 'Your account'}</div>
                <div className="text-xs text-paper-dim truncate">{user?.email}</div>
              </div>
              <Link
                to="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-paper-dim hover:text-paper hover:bg-ink-700 transition-colors"
              >
                <User className="h-4 w-4" />
                Settings
              </Link>
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-domain-video hover:bg-ink-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default TopBar;
