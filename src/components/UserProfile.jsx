import React, { useState } from 'react';
import { Play, Music, Mic, Film, Newspaper, Settings, Save, RotateCcw } from 'lucide-react';

const UserProfile = ({ preferences, onPreferenceUpdate }) => {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const [hasChanges, setHasChanges] = useState(false);

  const domains = [
    { key: 'video', name: 'Videos', icon: Play, color: 'domain-video' },
    { key: 'music', name: 'Music', icon: Music, color: 'domain-music' },
    { key: 'podcast', name: 'Podcasts', icon: Mic, color: 'domain-podcast' },
    { key: 'movie', name: 'Movies', icon: Film, color: 'domain-movie' },
    { key: 'news', name: 'News', icon: Newspaper, color: 'domain-news' }
  ];

  const handlePreferenceChange = (domain, field, value) => {
    setLocalPreferences(prev => ({
      ...prev,
      [domain]: {
        ...prev[domain],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    Object.entries(localPreferences).forEach(([domain, prefs]) => {
      onPreferenceUpdate(domain, prefs);
    });
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalPreferences(preferences);
    setHasChanges(false);
  };

  const getInterestLevel = (domain) => {
    const prefs = localPreferences[domain] || {};
    if (prefs.interested) return 'High';
    if (prefs.neutral) return 'Medium';
    return 'Low';
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-paper mb-2">
            User Profile & Preferences
          </h1>
          <p className="text-paper-dim">
            Customize your recommendation preferences across different content domains
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mb-6">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 border border-ink-700 bg-ink-900 text-paper-dim rounded-full hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-ink-800 border border-ink-700 text-paper hover:bg-ink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

        {/* Domain Preferences */}
        <div className="space-y-6">
          {domains.map(domain => {
            const Icon = domain.icon;
            const prefs = localPreferences[domain.key] || {};
            
            return (
              <div key={domain.key} className="rounded-2xl bg-ink-900 border border-ink-700 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Icon className="w-6 h-6 text-paper-dim" />
                  <h2 className="text-xl font-semibold text-paper">{domain.name}</h2>
                  <span className={`domain-badge ${domain.color}`}>
                    {getInterestLevel(domain.key)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Interest Level */}
                  <div>
                    <label className="block text-sm font-medium text-paper-dim mb-2">
                      Interest Level
                    </label>
                    <select
                      value={prefs.interested ? 'high' : prefs.neutral ? 'medium' : 'low'}
                      onChange={(e) => {
                        const value = e.target.value;
                        handlePreferenceChange(domain.key, 'interested', value === 'high');
                        handlePreferenceChange(domain.key, 'neutral', value === 'medium');
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-ink-700 text-paper focus:outline-none focus:ring-2 focus:ring-signal/60"
                    >
                      <option value="high">High - Show me more content</option>
                      <option value="medium">Medium - Balanced recommendations</option>
                      <option value="low">Low - Less content please</option>
                    </select>
                  </div>

                  {/* Preferred Categories */}
                  <div>
                    <label className="block text-sm font-medium text-paper-dim mb-2">
                      Preferred Categories
                    </label>
                    <input
                      type="text"
                      value={prefs.categories || ''}
                      onChange={(e) => handlePreferenceChange(domain.key, 'categories', e.target.value)}
                      placeholder="e.g. technology, comedy, drama"
                      className="w-full px-3 py-2 rounded-lg bg-ink-900 border border-ink-700 text-paper placeholder:text-paper-dim/50 focus:outline-none focus:ring-2 focus:ring-signal/60"
                    />
                  </div>

                  {/* Content Rating */}
                  <div>
                    <label className="block text-sm font-medium text-paper-dim mb-2">
                      Content Rating Preference
                    </label>
                    <select
                      value={prefs.rating || 'all'}
                      onChange={(e) => handlePreferenceChange(domain.key, 'rating', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-ink-700 text-paper focus:outline-none focus:ring-2 focus:ring-signal/60"
                    >
                      <option value="all">All Ratings</option>
                      <option value="general">General Audience</option>
                      <option value="teen">Teen</option>
                      <option value="mature">Mature</option>
                    </select>
                  </div>

                  {/* Language Preference */}
                  <div>
                    <label className="block text-sm font-medium text-paper-dim mb-2">
                      Language Preference
                    </label>
                    <select
                      value={prefs.language || 'en'}
                      onChange={(e) => handlePreferenceChange(domain.key, 'language', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-black/30 border border-ink-700 text-paper focus:outline-none focus:ring-2 focus:ring-signal/60"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                      <option value="all">All Languages</option>
                    </select>
                  </div>
                </div>

                {/* Additional Settings */}
                <div className="mt-4 pt-4 border-t border-ink-700">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={prefs.notifications || false}
                        onChange={(e) => handlePreferenceChange(domain.key, 'notifications', e.target.checked)}
                        className="rounded border-ink-600 bg-ink-800 text-signal focus:ring-signal"
                      />
                      <span className="text-sm text-paper-dim">
                        Enable notifications for new {domain.name.toLowerCase()}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 rounded-2xl p-6 bg-ink-900 border border-ink-700">
          <h3 className="text-lg font-semibold text-paper mb-4">Preference Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-signal">
                {domains.filter(d => localPreferences[d.key]?.interested).length}
              </div>
              <div className="text-sm text-paper-dim">High Interest</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {domains.filter(d => localPreferences[d.key]?.neutral).length}
              </div>
              <div className="text-sm text-paper-dim">Medium Interest</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400">
                {domains.filter(d => !localPreferences[d.key]?.interested && !localPreferences[d.key]?.neutral).length}
              </div>
              <div className="text-sm text-paper-dim">Low Interest</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {domains.filter(d => localPreferences[d.key]?.notifications).length}
              </div>
              <div className="text-sm text-paper-dim">Notifications Enabled</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
