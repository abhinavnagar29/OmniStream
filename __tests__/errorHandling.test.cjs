const request = require('supertest');

const { createApp } = require('../backend/app');

describe('Error handling & edge cases', () => {
  const app = createApp();

  async function registerAndLogin() {
    const email = `edge_${Date.now()}_${Math.random()}@test.local`;
    const res = await request(app).post('/api/auth/signup').send({ email, password: 'password123' });
    return { token: res.body.token };
  }

  test('malformed JSON body returns 400, not 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "test@test.com", "password": '); // truncated/invalid JSON
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('search query with SQL-wildcard characters does not crash and returns safely', async () => {
    const res = await request(app).get('/api/search').query({ q: "%'; DROP TABLE content; --" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('search query with unicode/emoji does not crash', async () => {
    const res = await request(app).get('/api/search').query({ q: '🎬🍿 movie 电影' });
    expect(res.status).toBe(200);
  });

  test('extremely long search query is handled without crashing', async () => {
    const res = await request(app).get('/api/search').query({ q: 'a'.repeat(5000) });
    expect([200, 400]).toContain(res.status);
  });

  test('recommendations limit above max is rejected with 400, not silently clamped or 500', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?limit=99999').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
  });

  test('recommendations limit of 0 or negative is rejected', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).get('/api/recommendations?limit=0').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
  });

  test('non-JSON content-type on a POST with a body is handled gracefully', async () => {
    const res = await request(app)
      .post('/api/feedback/like')
      .set('Content-Type', 'text/plain')
      .send('itemId=v_ai_1');
    expect([400, 401]).toContain(res.status); // either validation fails or auth is checked first -- never 500
  });

  test('feedback with an empty body returns 400 (validation), not 500', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app).post('/api/feedback/like').set({ Authorization: `Bearer ${token}` }).send({});
    expect(res.status).toBe(400);
  });

  test('onboarding with invalid enum values returns 400, not 500', async () => {
    const { token } = await registerAndLogin();
    const res = await request(app)
      .post('/api/onboarding')
      .set({ Authorization: `Bearer ${token}` })
      .send({ topics: ['not_a_real_topic'], domains: ['video'], goals: ['learn'] });
    expect(res.status).toBe(400);
  });

  test('signup with an obviously invalid email is rejected with 400', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  test('JWT signed with a different secret is rejected, not crashes the server', async () => {
    const jwt = require('jsonwebtoken');
    const forgedToken = jwt.sign({ sub: 'fake-user-id', email: 'x@x.com' }, 'wrong-secret');
    const res = await request(app).get('/api/profile').set({ Authorization: `Bearer ${forgedToken}` });
    expect(res.status).toBe(401);
  });

  test('expired JWT is rejected with 401, not crashes', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign({ sub: 'some-id', email: 'x@x.com' }, process.env.JWT_SECRET, { expiresIn: '-10s' });
    const res = await request(app).get('/api/profile').set({ Authorization: `Bearer ${expiredToken}` });
    expect(res.status).toBe(401);
  });

  test('a token for a since-deleted/nonexistent user returns 404, not 500', async () => {
    const jwt = require('jsonwebtoken');
    const fakeButValidToken = jwt.sign({ sub: '00000000-0000-0000-0000-000000000000', email: 'ghost@test.local' }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${fakeButValidToken}` });
    expect(res.status).toBe(404);
  });

  test('concurrent identical signups (race condition) -- exactly one succeeds, the rest get 409, none 500', async () => {
    const email = `race_${Date.now()}@test.local`;
    const attempts = Array.from({ length: 5 }, () =>
      request(app).post('/api/auth/signup').send({ email, password: 'password123' })
    );
    const results = await Promise.all(attempts);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);
  });

  test('liking the same item twice does not error (idempotent-ish, second call still 201)', async () => {
    const { token } = await registerAndLogin();
    const first = await request(app).post('/api/feedback/like').set({ Authorization: `Bearer ${token}` }).send({ itemId: 'v_ai_1' });
    const second = await request(app).post('/api/feedback/like').set({ Authorization: `Bearer ${token}` }).send({ itemId: 'v_ai_1' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  test('health endpoint never returns 500 even if it reports a dependency as down', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
  });

  test('a request with no Authorization header at all (not even "Bearer") is 401, not 500', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  test('a request with a garbage Authorization scheme is 401, not 500', async () => {
    const res = await request(app).get('/api/profile').set({ Authorization: 'Basic dXNlcjpwYXNz' });
    expect(res.status).toBe(401);
  });
});
