const request = require('supertest');

const { createApp } = require('../backend/app');
const { content } = require('../backend/data/content');

describe('API', () => {
  const app = createApp();

  test('dataset has 100+ items for meaningful recommendations', () => {
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBeGreaterThanOrEqual(100);
  });

  test('GET /api/profile returns learned vectors', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary).toHaveProperty('topTopics');
  });

  test('profile learns from impression events', async () => {
    const userId = 'learn_impression_1';

    await request(app)
      .post('/api/analytics')
      .set('x-user-id', userId)
      .send({ event: 'impression', data: { itemIds: ['v_ai_1', 'p_ai_1', 'n_ai_1'] } });

    const res = await request(app).get('/api/profile').set('x-user-id', userId);
    expect(res.status).toBe(200);
    const topics = res.body.data.summary.topTopics.map((x) => x.key);
    expect(topics).toContain('ai');
  });

  test('profile learns from search events', async () => {
    const userId = 'learn_search_1';

    await request(app)
      .post('/api/analytics')
      .set('x-user-id', userId)
      .send({ event: 'search', data: { query: 'space rockets', topTopics: [{ topic: 'space', count: 3 }] } });

    const res = await request(app).get('/api/profile').set('x-user-id', userId);
    expect(res.status).toBe(200);
    const topics = res.body.data.summary.topTopics.map((x) => x.key);
    expect(topics).toContain('space');
  });

  test('GET /api/personas returns persona list', async () => {
    const res = await request(app).get('/api/personas');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
  });

  test('GET /api/journeys returns cross-domain bundles', async () => {
    const res = await request(app).get('/api/journeys');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('items');
    expect(res.body.data[0]).toHaveProperty('steps');
    expect(Array.isArray(res.body.data[0].steps)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('totalMinutes');
    expect(res.body.data[0]).toHaveProperty('type');
  });

  test('GET /api/metrics returns evaluation data', async () => {
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('dataset');
    expect(res.body.data.dataset).toHaveProperty('totalItems');
    expect(res.body.data).toHaveProperty('recommender');
    expect(res.body.data.recommender).toHaveProperty('domainCoverage');
    expect(res.body.data.recommender).toHaveProperty('diversity');
    expect(res.body.data.recommender).toHaveProperty('personalizationConfidence');
    expect(res.body.data.recommender).toHaveProperty('explanationCoverage');
  });

  test('POST /api/onboarding seeds preferences for new user', async () => {
    const userId = 'new_user_1';
    const res = await request(app)
      .post('/api/onboarding')
      .set('x-user-id', userId)
      .send({ topics: ['ai'], domains: ['video', 'podcast'], goals: ['learn'] });

    expect(res.status).toBe(201);

    const prefs = await request(app).get('/api/preferences').set('x-user-id', userId);
    expect(prefs.status).toBe(200);
    expect(Object.keys(prefs.body.data).length).toBeGreaterThan(0);
  });

  test('POST /api/onboarding returns 409 if already completed', async () => {
    const userId = 'new_user_2';
    await request(app)
      .post('/api/onboarding')
      .set('x-user-id', userId)
      .send({ topics: ['ai'], domains: ['video'], goals: ['learn'] });

    const res2 = await request(app)
      .post('/api/onboarding')
      .set('x-user-id', userId)
      .send({ topics: ['ai'], domains: ['video'], goals: ['learn'] });

    expect(res2.status).toBe(409);
  });

  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('timestamp');
  });

  test('GET /api/recommendations returns array payload', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('recommendations include explanation payload', async () => {
    const res = await request(app).get('/api/recommendations?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('explanation');
    expect(res.body.data[0].explanation).toHaveProperty('reasons');
  });

  test('GET /api/recommendations validates domain', async () => {
    const res = await request(app).get('/api/recommendations?domain=bad');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /api/preferences returns object', async () => {
    const res = await request(app).get('/api/preferences');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(typeof res.body.data).toBe('object');
  });

  test('POST /api/preferences/:domain requires body fields', async () => {
    const res = await request(app).post('/api/preferences/video').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/preferences/:domain updates', async () => {
    const res = await request(app)
      .post('/api/preferences/video')
      .send({ interested: true, categories: 'ai,technology' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('interested', true);
  });

  test('GET /api/search requires q', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /api/search supports domains validation', async () => {
    const res = await request(app).get('/api/search?q=ai&domains=video,bad');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('GET /api/search returns results', async () => {
    const res = await request(app).get('/api/search?q=ai&domains=video');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/search supports sortBy=oldest', async () => {
    const res = await request(app).get('/api/search?q=ai&sortBy=oldest');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /api/search supports sortBy=popularity', async () => {
    const res = await request(app).get('/api/search?q=ai&sortBy=popularity');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  test('GET /api/recommendations supports mode=trending', async () => {
    const res = await request(app).get('/api/recommendations?mode=trending');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/recommendations supports explore=0..1', async () => {
    const res0 = await request(app).get('/api/recommendations?explore=0');
    expect(res0.status).toBe(200);
    const res1 = await request(app).get('/api/recommendations?explore=1');
    expect(res1.status).toBe(200);
  });

  test('GET /api/recommendations rejects explore out of range', async () => {
    const res = await request(app).get('/api/recommendations?explore=2');
    expect(res.status).toBe(400);
  });

  test('GET /api/library returns liked items list', async () => {
    const res = await request(app).get('/api/library');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('liked');
    expect(Array.isArray(res.body.data.liked)).toBe(true);
  });

  test('POST /api/feedback/like stores like and library contains item', async () => {
    const likeRes = await request(app).post('/api/feedback/like').send({ itemId: 'v_ai_1' });
    expect(likeRes.status).toBe(201);

    const libRes = await request(app).get('/api/library');
    expect(libRes.status).toBe(200);
    const ids = libRes.body.data.liked.map((x) => x.id);
    expect(ids).toContain('v_ai_1');
  });

  test('likes are isolated per userId', async () => {
    await request(app)
      .post('/api/feedback/like')
      .set('x-user-id', 'tech_learner')
      .send({ itemId: 'v_ai_2' });

    const libTech = await request(app).get('/api/library').set('x-user-id', 'tech_learner');
    const idsTech = libTech.body.data.liked.map((x) => x.id);
    expect(idsTech).toContain('v_ai_2');

    const libSports = await request(app).get('/api/library').set('x-user-id', 'sports_fan');
    const idsSports = libSports.body.data.liked.map((x) => x.id);
    expect(idsSports).not.toContain('v_ai_2');
  });

  test('POST /api/feedback/unlike removes like from library', async () => {
    await request(app).post('/api/feedback/like').send({ itemId: 'p_ai_1' });

    const unlikeRes = await request(app).post('/api/feedback/unlike').send({ itemId: 'p_ai_1' });
    expect(unlikeRes.status).toBe(201);

    const libRes = await request(app).get('/api/library');
    const ids = libRes.body.data.liked.map((x) => x.id);
    expect(ids).not.toContain('p_ai_1');
  });

  test('POST /api/feedback/open and /skip accept known items', async () => {
    const openRes = await request(app).post('/api/feedback/open').send({ itemId: 'm_ai_1' });
    expect(openRes.status).toBe(201);
    const skipRes = await request(app).post('/api/feedback/skip').send({ itemId: 'm_ai_1' });
    expect(skipRes.status).toBe(201);
  });

  test('POST /api/feedback/* returns 404 for unknown item', async () => {
    const res = await request(app).post('/api/feedback/like').send({ itemId: 'does-not-exist' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/analytics validates body', async () => {
    const res = await request(app).post('/api/analytics').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/analytics stores event', async () => {
    const res = await request(app)
      .post('/api/analytics')
      .send({ event: 'open_item', data: { id: 'v1' } });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('event', 'open_item');
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
