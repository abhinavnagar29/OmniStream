import React, { useEffect, useState } from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { getPersonas, getUserId, setUserId } from '../services/api';

function TopBar({ onSearch, onUserChange }) {
  const [q, setQ] = useState('');
  const [personas, setPersonas] = useState([]);
  const [userId, setLocalUserId] = useState(getUserId());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getPersonas();
        if (!cancelled) setPersonas(list);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to load personas', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-[#0B0F19]/60 backdrop-blur border-b border-white/10 sticky top-0 z-40">
      <div className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input
            value={q}
            onChange={(e) => {
              const next = e.target.value;
              setQ(next);
              onSearch?.(next);
            }}
            placeholder="Search videos, music, podcasts, movies, news..."
            className="w-full h-10 pl-10 pr-3 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pl-4">
        <button className="h-10 w-10 rounded-full bg-white/5 border border-white/10 grid place-items-center text-white/80 hover:text-white hover:bg-white/10">
          <Bell className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 h-10 pl-2 pr-3 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-200/40 to-white/10" />
          <select
            value={userId}
            onChange={(e) => {
              const next = setUserId(e.target.value);
              setLocalUserId(next);
              onUserChange?.(next);
            }}
            className="bg-transparent text-sm focus:outline-none"
          >
            <option value="demo">Demo</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}

export default TopBar;
