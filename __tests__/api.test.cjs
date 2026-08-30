const request = require('supertest');

const { createApp } = require('../backend/app');

describe('API', () => {
  const app = createApp();
  let uniqueCounter = 0;

  async function registerAndLogin(overrides = {}) {
    uniqueCounter += 1;
    const email = overrides.email || `user_${Date.now()}_${uniqueCounter}@test.local`;
    const password = overrides.password || 'password123';
    const signupRes = await request(app).post('/api/auth/signup').send({ email, password, displayName: 'Test User' });
    expect(signupRes.status).toBe(201);
    return { token: signupRes.body.token, user: signupRes.body.user, email, password };
  }

  function auth(token) {
    return { Authorization: `Bearer ${token}` };
  }

  // ---------------- Auth ----------------

  test('POST /api/auth/signup creates a user and returns a JWT', async () => {
    const { token, user } = await registerAndLogin();
    expect(token).toEqual(expect.any(String));
    expect(user).toHaveProperty('id');
    expect(user).not.toHaveProperty('password_hash');
  });

  test('POST /api/auth/signup rejects a duplicate email', async () => {
    const { email, password } = await registerAndLogin();
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'somethingelse123' });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/signup rejects a short password', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'short@test.local', password: '123' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login succeeds with correct credentials', async () => {
    const { email, password } = await registerAndLogin();
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login rejects wrong password', async () => {
    const { email } = await registerAndLogin();
    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me requires a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me returns the authenticated user', async () => {
    const { token, user } = await registerAndLogin();
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.id);
  });

  test('protected routes reject an invalid token', async () => {
    const res = await request(app).get('/api/profile').set({ Authorization: 'Bearer not-a-real-token' });
    expect(res.status).toBe(401);
  });

  // ---------------- Onboarding / preferences / profile ----------------

  test('POST /api/onboarding seeds preferences for a new user', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/onboarding')
      .set(auth(token))
      .send({ topics: ['ai'], domains: ['video', 'podcast'], goals: ['learn'] });
    expect(res.status).toBe(201);

    const prefs = await request(app).get('/api/preferences').set(auth(token));
    expect(prefs.status).toBe(200);
    expect(Object.keys(prefs.body.data).length).toBeGreaterThan(0);
  });

  test('POST /api/onboarding returns 409 if already completed', async () => {
    const { token } = await registerAndLogin();
    await request(app).post('/api/onboarding').set(auth(token)).send({ topics: ['ai'], domains: ['video'], goals: ['learn'] });
    const res2 = await request(app).post('/api/onboarding').set(auth(token)).send({ topics: ['ai'], domains: ['video'], goals: ['learn'] });
    expect(res2.status).toBe(409);
  });

  test('GET /api/profile returns learned vectors and is cold-start before any interactions', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/profile').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary).toHaveProperty('topTopics');
    expect(res.body.data.isColdStart).toBe(true);
  });

  test('profile updates after a like interaction', async () => {
    const { token } = await registerAndLogin();
    await request(app).post('/api/feedback/like').set(auth(token)).send({ itemId: 'v_ai_1' });

    const res = await request(app).get('/api/profile').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data.isColdStart).toBe(false);
    const topics = res.body.data.summary.topTopics.map((x) => x.key);
    expect(topics).toContain('ai');
  });

  test('POST /api/preferences/:domain requires body fields', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post('/api/preferences/video').set(auth(token)).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/preferences/:domain updates', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/preferences/video')
      .set(auth(token))
      .send({ interested: true, categories: 'ai,technology' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('interested', true);
  });

  // ---------------- Recommendations ----------------

  test('GET /api/recommendations requires auth', async () => {
    const res = await request(app).get('/api/recommendations');
    expect(res.status).toBe(401);
  });

  test('GET /api/recommendations returns a ranked, explained list (cold start)', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?limit=5').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('explanation');
    expect(res.body.data[0].explanation).toHaveProperty('reasons');
    expect(res.body.data[0]).not.toHaveProperty('embedding'); // never leak raw vectors over the API
  });

  test('GET /api/recommendations validates domain', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?domain=bad').set(auth(token));
    expect(res.status).toBe(400);
  });

  test('GET /api/recommendations supports mode=trending', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?mode=trending').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/recommendations rejects explore out of range', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?explore=2').set(auth(token));
    expect(res.status).toBe(400);
  });

  test('recommendations are cached on the second identical request (X-Cache header)', async () => {
    const { token } = await registerAndLogin();
    const first = await request(app).get('/api/recommendations?limit=5').set(auth(token));
    expect(first.headers['x-cache']).toBe('MISS');
    const second = await request(app).get('/api/recommendations?limit=5').set(auth(token));
    expect(second.headers['x-cache']).toBe('HIT');
  });

  // ---------------- Feedback / library ----------------

  test('GET /api/library returns liked items list', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/library').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.liked)).toBe(true);
  });

  test('POST /api/feedback/like stores like and library contains item', async () => {
    const { token } = await registerAndLogin();
    const likeRes = await request(app).post('/api/feedback/like').set(auth(token)).send({ itemId: 'v_ai_1' });
    expect(likeRes.status).toBe(201);

    const libRes = await request(app).get('/api/library').set(auth(token));
    const ids = libRes.body.data.liked.map((x) => x.id);
    expect(ids).toContain('v_ai_1');
  });

  test('likes are isolated per user', async () => {
    const alice = await registerAndLogin();
    const bob = await registerAndLogin();

    await request(app).post('/api/feedback/like').set(auth(alice.token)).send({ itemId: 'v_ai_2' });

    const libAlice = await request(app).get('/api/library').set(auth(alice.token));
    expect(libAlice.body.data.liked.map((x) => x.id)).toContain('v_ai_2');

    const libBob = await request(app).get('/api/library').set(auth(bob.token));
    expect(libBob.body.data.liked.map((x) => x.id)).not.toContain('v_ai_2');
  });

  test('POST /api/feedback/unlike removes like from library', async () => {
    const { token } = await registerAndLogin();
    await request(app).post('/api/feedback/like').set(auth(token)).send({ itemId: 'p_ai_1' });
    const unlikeRes = await request(app).post('/api/feedback/unlike').set(auth(token)).send({ itemId: 'p_ai_1' });
    expect(unlikeRes.status).toBe(201);

    const libRes = await request(app).get('/api/library').set(auth(token));
    expect(libRes.body.data.liked.map((x) => x.id)).not.toContain('p_ai_1');
  });

  test('POST /api/feedback/open and /skip accept known items', async () => {
    const { token } = await registerAndLogin();
    const openRes = await request(app).post('/api/feedback/open').set(auth(token)).send({ itemId: 'm_ai_1' });
    expect(openRes.status).toBe(201);
    const skipRes = await request(app).post('/api/feedback/skip').set(auth(token)).send({ itemId: 'm_ai_1' });
    expect(skipRes.status).toBe(201);
  });

  test('POST /api/feedback/* returns 404 for unknown item', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post('/api/feedback/like').set(auth(token)).send({ itemId: 'does-not-exist' });
    expect(res.status).toBe(404);
  });

  // ---------------- Analytics / personas / journeys / metrics ----------------

  test('POST /api/analytics validates body', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post('/api/analytics').set(auth(token)).send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/analytics is accepted asynchronously (202, queued not yet persisted)', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post('/api/analytics').set(auth(token)).send({ event: 'open_item', data: { id: 'v1' } });
    expect(res.status).toBe(202);
    expect(res.body.data).toHaveProperty('queued', true);
    expect(res.body.data).toHaveProperty('streamId');
  });

  test('GET /api/personas returns persona list (public)', async () => {
    const res = await request(app).get('/api/personas');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /api/journeys returns cross-domain bundles', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/journeys').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('steps');
  });

  test('GET /api/metrics returns evaluation data', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/metrics').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('dataset');
    expect(res.body.data.recommender).toHaveProperty('diversity');
  });

  // ---------------- Search (public) ----------------

  test('GET /api/search requires q', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
  });

  test('GET /api/search returns results', async () => {
    const res = await request(app).get('/api/search?q=ai&domains=video');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ---------------- Experiments (A/B mechanism) ----------------

  test('GET /api/experiments/:name/variant assigns a deterministic variant', async () => {
    const { token } = await registerAndLogin();
    const first = await request(app).get('/api/experiments/ranking_v2/variant').set(auth(token));
    expect(first.status).toBe(200);
    expect(['control', 'treatment']).toContain(first.body.data.variant);

    const second = await request(app).get('/api/experiments/ranking_v2/variant').set(auth(token));
    expect(second.body.data.variant).toBe(first.body.data.variant); // persisted, not re-randomized
  });

  // ---------------- Health / misc ----------------

  test('GET /api/health reports database and redis connectivity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.dependencies.database).toBe('ok');
    expect(res.body.dependencies.redis).toBe('ok');
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
