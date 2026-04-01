import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import DomainPage from './components/DomainPage';
import LibraryPage from './components/LibraryPage';
import JourneysPage from './components/JourneysPage';
import MetricsPage from './components/MetricsPage';
import OnboardingPage from './components/OnboardingPage';
import UserProfile from './components/UserProfile';
import SearchPage from './components/SearchPage';
import { getRecommendations, getUserPreferences, updateUserPreferences } from './services/api';

function useRecommendationMode() {
  const location = useLocation();
  if (location.pathname === '/trending') return 'trending';
  if (location.pathname === '/for-you') return 'for-you';
  return 'home';
}

function InnerApp() {
  const [recommendations, setRecommendations] = useState([]);
  const [userPreferences, setUserPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUserId, setActiveUserId] = useState('demo');
  const [explore, setExplore] = useState(0.25);
  const mode = useRecommendationMode();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    loadInitialData();
  }, [mode, activeUserId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setAppError('');
      const [recommendationsData, preferencesData] = await Promise.all([
        getRecommendations({ mode, explore }),
        getUserPreferences()
      ]);
      setRecommendations(recommendationsData);
      setUserPreferences(preferencesData);

      const hasPrefs = preferencesData && Object.keys(preferencesData).length > 0;
      const isOnboarding = location.pathname === '/onboarding';
      if (!hasPrefs && !isOnboarding) {
        navigate('/onboarding');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      setAppError(error?.response?.data?.error?.message || error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceUpdate = async (domain, preferences) => {
    try {
      await updateUserPreferences(domain, preferences);
      setUserPreferences(prev => ({
        ...prev,
        [domain]: preferences
      }));
      // Refresh recommendations with new preferences
      const updatedRecommendations = await getRecommendations({ mode, explore });
      setRecommendations(updatedRecommendations);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const visibleRecommendations = searchQuery.trim()
    ? recommendations.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.title?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.tags?.some((t) => String(t).toLowerCase().includes(q))
        );
      })
    : recommendations;

  return (
    <div className="min-h-screen bg-[#070A12] text-white">
      {appError ? (
        <div className="px-4 lg:px-6 pt-4">
          <div className="max-w-5xl mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 p-4 text-sm">
            API/Startup error: {appError}
          </div>
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <TopBar
            onSearch={setSearchQuery}
            onUserChange={(id) => {
              setActiveUserId(id);
              setSearchQuery('');
            }}
          />
          <Routes>
            <Route
              path="/onboarding"
              element={
                <OnboardingPage
                  onDone={() => {
                    setActiveUserId((x) => String(x));
                    navigate('/');
                  }}
                />
              }
            />
            <Route
              path="/"
              element={
                <Dashboard
                  recommendations={visibleRecommendations}
                  loading={loading}
                  explore={explore}
                  onExploreChange={(v) => {
                    setExplore(v);
                  }}
                />
              }
            />
            <Route
              path="/for-you"
              element={
                <Dashboard
                  recommendations={visibleRecommendations}
                  loading={loading}
                  explore={explore}
                  onExploreChange={(v) => {
                    setExplore(v);
                  }}
                />
              }
            />
            <Route
              path="/trending"
              element={
                <Dashboard
                  recommendations={visibleRecommendations}
                  loading={loading}
                  explore={explore}
                  onExploreChange={(v) => {
                    setExplore(v);
                  }}
                />
              }
            />
            <Route path="/journeys" element={<JourneysPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route
              path="/domain/:domain"
              element={<DomainPage recommendations={visibleRecommendations} loading={loading} />}
            />
            <Route path="/search" element={<SearchPage />} />
            <Route
              path="/profile"
              element={
                <UserProfile preferences={userPreferences} onPreferenceUpdate={handlePreferenceUpdate} />
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <InnerApp />
    </Router>
  );
}

export default App;
