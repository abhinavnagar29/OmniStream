import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Play, Music, Mic, Film, Newspaper } from 'lucide-react';
import { searchContent, trackEvent } from '../services/api';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    domains: ['video', 'music', 'podcast', 'movie', 'news'],
    sortBy: 'relevance'
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (query.trim()) {
      const timeoutId = setTimeout(() => {
        performSearch();
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setResults([]);
    }
  }, [query, filters]);

  const performSearch = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const searchResults = await searchContent(query, filters);
      setResults(searchResults);

      try {
        const topicCounts = {};
        for (const r of searchResults || []) {
          if (!r?.topic) continue;
          topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
        }
        const topTopics = Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([topic, count]) => ({ topic, count }));

        await trackEvent('search', {
          query,
          domains: filters?.domains,
          sortBy: filters?.sortBy,
          resultCount: Array.isArray(searchResults) ? searchResults.length : 0,
          topTopics,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to track search:', e);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDomainToggle = (domain) => {
    setFilters(prev => ({
      ...prev,
      domains: prev.domains.includes(domain)
        ? prev.domains.filter(d => d !== domain)
        : [...prev.domains, domain]
    }));
  };

  const getDomainIcon = (domain) => {
    const icons = {
      video: Play,
      music: Music,
      podcast: Mic,
      movie: Film,
      news: Newspaper
    };
    return icons[domain] || Play;
  };

  const getDomainColor = (domain) => {
    const colors = {
      video: 'domain-video',
      music: 'domain-music',
      podcast: 'domain-podcast',
      movie: 'domain-movie',
      news: 'domain-news'
    };
    return colors[domain] || 'domain-video';
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Search Content
          </h1>
          <p className="text-white/60">
            Find videos, music, podcasts, movies, and news across all platforms
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for content..."
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                />
                {query && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-lg border transition-colors ${
                  showFilters || Object.values(filters.domains).length < 5
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                    : 'border-white/10 text-white/80 hover:bg-white/10'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-white/80 mb-2">Content Domains</h3>
                <div className="flex flex-wrap gap-2">
                  {['video', 'music', 'podcast', 'movie', 'news'].map(domain => {
                    const Icon = getDomainIcon(domain);
                    return (
                      <button
                        key={domain}
                        onClick={() => handleDomainToggle(domain)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-colors ${
                          filters.domains.includes(domain)
                            ? 'border-indigo-500/50 bg-indigo-500/10 text-white'
                            : 'border-white/10 text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="capitalize">{domain}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-white/80 mb-2">Sort By</h3>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="rating">Highest Rating</option>
                  <option value="popularity">Most Popular</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        )}

        {/* Search Results */}
        {!loading && (
          <div>
            {query && (
              <div className="mb-4">
                <p className="text-white/60">
                  {results.length > 0 
                    ? `Found ${results.length} results for "${query}"`
                    : `No results found for "${query}"`
                  }
                </p>
              </div>
            )}

            <div className="space-y-4">
              {results.map((item) => {
                const Icon = getDomainIcon(item.domain);
                
                return (
                  <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition cursor-pointer">
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      {item.thumbnail && (
                        <div className="flex-shrink-0 w-24 h-24 bg-black/30 rounded-lg overflow-hidden">
                          <img 
                            src={item.thumbnail} 
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-2">
                          <Icon className="w-5 h-5 text-white/70 flex-shrink-0" />
                          <span className={`domain-badge ${getDomainColor(item.domain)}`}>
                            {item.domain}
                          </span>
                        </div>

                        <h3 className="font-semibold text-white mb-1 line-clamp-2">
                          {item.title}
                        </h3>

                        <p className="text-sm text-white/60 mb-2 line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-white/50">
                          {item.duration && (
                            <span>{item.duration}</span>
                          )}
                          {item.rating && (
                            <span>Rating {item.rating}</span>
                          )}
                          {item.source && (
                            <span>via {item.source}</span>
                          )}
                          {item.date && (
                            <span>{item.date}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => window.open(item.url, '_blank')}
                          className="px-3 py-1.5 bg-white/10 border border-white/10 text-white rounded-full hover:bg-white/20 transition-colors text-sm"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {!query && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-white/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  Start searching
                </h3>
                <p className="text-white/60">
                  Enter a search term to find content across all domains
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
