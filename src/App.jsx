import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MobileNav from './components/MobileNav';
import Dashboard from './components/Dashboard';
import DomainPage from './components/DomainPage';
import LibraryPage from './components/LibraryPage';
import JourneysPage from './components/JourneysPage';
import MetricsPage from './components/MetricsPage';
import OnboardingPage from './components/OnboardingPage';
import UserProfile from './components/UserProfile';
import SearchPage from './components/SearchPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import NotFoundPage from './pages/NotFoundPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getRecommendations, getUserPreferences, updateUserPreferences } from './services/api';
import { AppToaster, toast } from './components/AppToaster';

function useRecommendationMode() {
  const location = useLocation();
  if (location.pathname === '/trending') return 'trending';
  if (location.pathname === '/for-you') return 'for-you';
  return 'home';
}

/** Redirects to /login (remembering where the user was headed) if there's no valid session. */
function RequireAuth({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-screen bg-ink-950 grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-signal/30 border-t-signal animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

/** Surfaces a friendly, de-duplicated toast when the client gets rate-limited, instead of a silent failure. */
function useRateLimitToast() {
  const lastShownRef = useRef(0);
  useEffect(() => {
    window.__omnistreamRateLimited = () => {
      const now = Date.now();
      if (now - lastShownRef.current < 5000) return; // don't spam if several requests 429 in a burst
      lastShownRef.current = now;
      toast.error("You're doing that a bit fast — give it a few seconds.");
    };
    return () => { delete window.__omnistreamRateLimited; };
  }, []);
}

function AppShell() {
  const [recommendations, setRecommendations] = useState([]);
  const [userPreferences, setUserPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [explore, setExplore] = useState(0.25);
  const mode = useRecommendationMode();
  const location = useLocation();
  const navigate = useNavigate();
  useRateLimitToast();

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setAppError('');
      const [recommendationsData, preferencesData] = await Promise.all([
        getRecommendations({ mode, explore }),
        getUserPreferences(),
      ]);
      setRecommendations(recommendationsData);
      setUserPreferences(preferencesData);

      const hasPrefs = preferencesData && Object.keys(preferencesData).length > 0;
      const isOnboarding = location.pathname === '/onboarding';
      if (!hasPrefs && !isOnboarding) {
        navigate('/onboarding');
      }
    } catch (error) {
      // A 401 here means the session just expired mid-session -- the axios
      // interceptor already logs the user out and the router will redirect
      // to /login on the next render, so don't also show an error banner
      // for it. Same for 429 -- the rate-limit toast already covers it.
      if (error?.response?.status !== 401 && error?.response?.status !== 429) {
        // eslint-disable-next-line no-console
        console.error('Error loading initial data:', error);
        setAppError(error?.response?.data?.error?.message || error?.message || String(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceUpdate = async (domain, preferences) => {
    try {
      await updateUserPreferences(domain, preferences);
      setUserPreferences((prev) => ({ ...prev, [domain]: preferences }));
      const updatedRecommendations = await getRecommendations({ mode, explore });
      setRecommendations(updatedRecommendations);
      toast.success('Preferences updated');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error updating preferences:', error);
      toast.error('Could not save your preferences');
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
    <div className="min-h-screen bg-ink-950 text-paper">
      {appError ? (
        <div className="px-4 lg:px-6 pt-4">
          <div className="max-w-5xl mx-auto rounded-2xl bg-domain-video/10 border border-domain-video/30 text-domain-video p-4 text-sm">
            Something went wrong loading your recommendations: {appError}
          </div>
        </div>
      ) : null}
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0">
          <TopBar onSearch={setSearchQuery} />
          <Routes>
            <Route
              path="/onboarding"
              element={<OnboardingPage onDone={() => navigate('/')} />}
            />
            <Route
              path="/"
              element={<Dashboard recommendations={visibleRecommendations} loading={loading} explore={explore} onExploreChange={setExplore} />}
            />
            <Route
              path="/for-you"
              element={<Dashboard recommendations={visibleRecommendations} loading={loading} explore={explore} onExploreChange={setExplore} />}
            />
            <Route
              path="/trending"
              element={<Dashboard recommendations={visibleRecommendations} loading={loading} explore={explore} onExploreChange={setExplore} />}
            />
            <Route path="/journeys" element={<JourneysPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/metrics" element={<MetricsPage />} />
            <Route path="/domain/:domain" element={<DomainPage recommendations={visibleRecommendations} loading={loading} />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<UserProfile preferences={userPreferences} onPreferenceUpdate={handlePreferenceUpdate} />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppToaster />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
