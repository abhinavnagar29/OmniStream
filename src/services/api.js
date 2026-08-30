import axios from 'axios';

axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const TOKEN_STORAGE_KEY = 'omni_auth_token';

// ---- Token management ----
// The old version of this file kept an `x-user-id` header the (now removed)
// hackathon-era backend read directly, with no real authentication behind
// it. The backend now issues signed JWTs and requires a `Bearer` token on
// every user-scoped route -- this is the actual fix for the 401s: attach
// the token to every request, and clear it (forcing the user back to
// /login) the moment the backend says it's no longer valid.

export const getStoredToken = () => localStorage.getItem(TOKEN_STORAGE_KEY);

export const setAuthToken = (token) => {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  delete axios.defaults.headers.common.Authorization;
};

// Apply any token already in storage as soon as this module loads, so a
// page refresh doesn't momentarily send unauthenticated requests.
const existingToken = getStoredToken();
if (existingToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${existingToken}`;
}

// A 401 from ANY request means the session is no longer valid (expired
// token, or the account no longer exists) -- drop it globally rather than
// letting each component discover this independently and show its own
// confusing error. A 429 means the client is being rate-limited -- surface
// it as a friendly, specific toast instead of a generic error banner.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined' && window.__omnistreamForceLogout) {
        window.__omnistreamForceLogout();
      }
    } else if (error?.response?.status === 429) {
      if (typeof window !== 'undefined' && window.__omnistreamRateLimited) {
        window.__omnistreamRateLimited();
      }
    }
    return Promise.reject(error);
  }
);

function unwrap(response) {
  // Backend returns { data: ... }
  const payload = response?.data;
  if (typeof payload === 'string') return payload;
  return payload?.data;
}

// ---- Auth ----

export const signup = async (email, password, displayName) => {
  const res = await axios.post('/auth/signup', { email, password, displayName });
  return res.data; // { user, token }
};

export const login = async (email, password) => {
  const res = await axios.post('/auth/login', { email, password });
  return res.data; // { user, token }
};

export const getMe = async () => {
  const res = await axios.get('/auth/me');
  return unwrap(res);
};

// ---- Recommendations / content ----

export const getRecommendations = async (filters = {}) => {
  const params = {};
  if (filters.domain && filters.domain !== 'all') params.domain = filters.domain;
  if (filters.limit) params.limit = filters.limit;
  if (filters.mode) params.mode = filters.mode;
  if (filters.explore !== undefined) params.explore = filters.explore;
  const res = await axios.get('/recommendations', { params });
  return unwrap(res) || [];
};

export const getUserPreferences = async () => {
  const res = await axios.get('/preferences');
  return unwrap(res) || {};
};

export const updateUserPreferences = async (domain, preferences) => {
  const res = await axios.post(`/preferences/${domain}`, preferences);
  return unwrap(res);
};

export const searchContent = async (query, filters) => {
  const params = {
    q: query,
    sortBy: filters?.sortBy || 'relevance',
  };
  if (filters?.domains?.length) params.domains = filters.domains.join(',');
  const res = await axios.get('/search', { params });
  return unwrap(res) || [];
};

export const trackEvent = async (event, data) => {
  const res = await axios.post('/analytics', { event, data });
  return unwrap(res);
};

export const getLibrary = async () => {
  const res = await axios.get('/library');
  return unwrap(res) || { liked: [] };
};

export const likeItem = async (itemId) => {
  const res = await axios.post('/feedback/like', { itemId });
  return unwrap(res);
};

export const unlikeItem = async (itemId) => {
  const res = await axios.post('/feedback/unlike', { itemId });
  return unwrap(res);
};

export const openItem = async (itemId) => {
  const res = await axios.post('/feedback/open', { itemId });
  return unwrap(res);
};

export const skipItem = async (itemId) => {
  const res = await axios.post('/feedback/skip', { itemId });
  return unwrap(res);
};

export const getPersonas = async () => {
  const res = await axios.get('/personas');
  return unwrap(res) || [];
};

export const getProfile = async () => {
  const res = await axios.get('/profile');
  return unwrap(res);
};

export const getJourneys = async () => {
  const res = await axios.get('/journeys');
  return unwrap(res) || [];
};

export const getMetrics = async () => {
  const res = await axios.get('/metrics');
  return unwrap(res);
};

export const submitOnboarding = async ({ topics, domains, goals }) => {
  const res = await axios.post('/onboarding', { topics, domains, goals });
  return unwrap(res);
};
