import axios from 'axios';

axios.defaults.baseURL = '/api';

const USER_ID_STORAGE_KEY = 'omni_user_id';

export const setUserId = (userId) => {
  const id = userId ? String(userId) : 'demo';
  axios.defaults.headers.common['x-user-id'] = id;
  localStorage.setItem(USER_ID_STORAGE_KEY, id);
  return id;
};

export const getUserId = () => {
  return localStorage.getItem(USER_ID_STORAGE_KEY) || 'demo';
};

// Initialize on module load
setUserId(getUserId());

function unwrap(response) {
  // Backend returns { data: ... }
  const payload = response?.data;
  if (typeof payload === 'string') return payload;
  return payload?.data;
}

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
