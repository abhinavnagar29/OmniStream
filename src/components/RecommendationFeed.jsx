import React, { useState } from 'react';
import { Play, Music, Mic, Film, Newspaper, Heart, ExternalLink, Clock, Star } from 'lucide-react';

const RecommendationFeed = ({ recommendations, loading, onPreferenceUpdate, userPreferences }) => {
  const [likedItems, setLikedItems] = useState(new Set());

  const handleLike = (itemId) => {
    const newLikedItems = new Set(likedItems);
    if (newLikedItems.has(itemId)) {
      newLikedItems.delete(itemId);
    } else {
      newLikedItems.add(itemId);
    }
    setLikedItems(newLikedItems);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="recommendation-grid">
      {recommendations.map((item) => {
        const Icon = getDomainIcon(item.domain);
        const isLiked = likedItems.has(item.id);
        
        return (
          <div key={item.id} className="content-card">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-gray-600" />
                <span className={`domain-badge ${getDomainColor(item.domain)}`}>
                  {item.domain}
                </span>
              </div>
              <button
                onClick={() => handleLike(item.id)}
                className={`p-1 rounded-full transition-colors ${
                  isLiked 
                    ? 'text-red-500 hover:text-red-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-3">
              {/* Thumbnail/Image */}
              {item.thumbnail && (
                <div className="w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                  <img 
                    src={item.thumbnail} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Title */}
              <h3 className="font-semibold text-gray-900 line-clamp-2">
                {item.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-600 line-clamp-3">
                {item.description}
              </p>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {item.duration && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.duration}</span>
                  </div>
                )}
                {item.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>{item.rating}</span>
                  </div>
                )}
                {item.source && (
                  <span className="text-gray-400">via {item.source}</span>
                )}
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.tags.slice(0, 3).map((tag, index) => (
                    <span 
                      key={index}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      +{item.tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => window.open(item.url, '_blank')}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open
                </button>
                <button
                  onClick={() => onPreferenceUpdate(item.domain, {
                    ...userPreferences[item.domain],
                    interested: true
                  })}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
                >
                  More like this
                </button>
              </div>
            </div>
          </div>
        );
      })}
      
      {recommendations.length === 0 && (
        <div className="col-span-full text-center py-12">
          <div className="text-gray-400 mb-4">
            <Play className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No recommendations yet
          </h3>
          <p className="text-gray-600">
            Start by exploring different content domains and setting your preferences.
          </p>
        </div>
      )}
    </div>
  );
};

export default RecommendationFeed;
