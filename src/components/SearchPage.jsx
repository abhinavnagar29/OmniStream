import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Play, Music, Mic, Film, Newspaper } from 'lucide-react';
import { searchContent, trackEvent } from '../services/api';
import { useContentInteractions } from '../hooks/useContentInteractions';
import MediaCard, { MediaCardSkeleton } from './MediaCard';
import ContentDetailModal from './ContentDetailModal';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    domains: ['video', 'music', 'podcast', 'movie', 'news'],
    sortBy: 'relevance'
  });
  const [showFilters, setShowFilters] = useState(false);
  const { likedIds, toggleLike, openContent, showDetail, detailItem, closeDetail } = useContentInteractions();

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

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <div className="px-4 lg:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-paper mb-2">
            Search Content
          </h1>
          <p className="text-paper-dim">
            Find videos, music, podcasts, movies, and news across all platforms
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-paper-dim/70" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for content..."
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-ink-900 border border-ink-700 text-paper placeholder:text-paper-dim/50 focus:outline-none focus:ring-2 focus:ring-signal/60"
                />
                {query && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-paper-dim/70 hover:text-paper"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-3 rounded-lg border transition-colors ${
                  showFilters || Object.values(filters.domains).length < 5
                    ? 'border-signal/50 bg-signal/10 text-paper'
                    : 'border-ink-700 text-paper-dim hover:bg-ink-800'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-4 p-4 bg-ink-900 border border-ink-700 rounded-xl">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-paper-dim mb-2">Content Domains</h3>
                <div className="flex flex-wrap gap-2">
                  {['video', 'music', 'podcast', 'movie', 'news'].map(domain => {
                    const Icon = getDomainIcon(domain);
                    return (
                      <button
                        key={domain}
                        onClick={() => handleDomainToggle(domain)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-colors ${
                          filters.domains.includes(domain)
                            ? 'border-signal/50 bg-signal/10 text-paper'
                            : 'border-ink-700 text-paper-dim hover:bg-ink-800'
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
                <h3 className="text-sm font-medium text-paper-dim mb-2">Sort By</h3>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-ink-700 text-paper focus:outline-none focus:ring-2 focus:ring-signal/60"
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
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 4 }).map((_, i) => <MediaCardSkeleton key={i} />)}
          </div>
        )}

        {/* Search Results */}
        {!loading && (
          <div>
            <ContentDetailModal
              open={Boolean(detailItem)}
              item={detailItem}
              liked={detailItem ? likedIds.has(detailItem.id) : false}
              onClose={closeDetail}
              onLike={toggleLike}
              onOpenExternal={(item) => window.open(item.url, '_blank', 'noopener,noreferrer')}
            />

            {query && (
              <div className="mb-4">
                <p className="text-paper-dim">
                  {results.length > 0
                    ? `Found ${results.length} results for "${query}"`
                    : `No results found for "${query}"`
                  }
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {results.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onOpen={openContent}
                  onLike={toggleLike}
                  onDetails={showDetail}
                  liked={likedIds.has(item.id)}
                />
              ))}
            </div>

            {/* Empty State */}
            {!query && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-paper-dim/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-paper mb-2">
                  Start searching
                </h3>
                <p className="text-paper-dim">
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
