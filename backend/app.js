const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');

const { logger } = require('./logger');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const openapiSpec = require('./openapi');
const { redis } = require('./db/redis');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const recommendationRoutes = require('./routes/recommendations');
const preferenceRoutes = require('./routes/preferences');
const searchRoutes = require('./routes/search');
const analyticsRoutes = require('./routes/analytics');
const libraryRoutes = require('./routes/library');
const feedbackRoutes = require('./routes/feedback');
const profileRoutes = require('./routes/profile');
const personasRoutes = require('./routes/personas');
const journeysRoutes = require('./routes/journeys');
const metricsRoutes = require('./routes/metrics');
const onboardingRoutes = require('./routes/onboarding');
const experimentsRoutes = require('./routes/experiments');

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      // Comma-separated list of allowed origins for a split-domain deploy
      // (frontend on Vercel, backend on Render, etc). Defaults to
      // allow-all, which is fine for same-origin deploys (server.js serving
      // the built frontend itself) and local dev, but should be set to the
      // real frontend origin(s) once this is actually deployed split.
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()) : true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  /**
   * Distributed rate limiting via Redis. A process-local (in-memory) limiter
   * -- what this originally used -- does not share state across multiple
   * backend instances behind a load balancer: each instance would allow its
   * own 120/min, so N instances effectively allow N*120/min. Backing the
   * limiter with Redis (rate-limit-redis) makes every instance enforce the
   * same shared counter, which is what actually makes "horizontally
   * scalable" a true statement about this API rather than an aspiration.
   *
   * Limit/window are configurable via env so load tests and the dedicated
   * rate-limit test (__tests__/rateLimit.test.cjs) can exercise this with a
   * tight window without waiting on the production default.
   */
  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
      limit: Number(process.env.RATE_LIMIT_MAX || 120),
      standardHeaders: true,
      legacyHeaders: false,
      store: new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: 'rl:',
      }),
    })
  );

  if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get('/api/openapi.json', (_req, res) => res.json(openapiSpec));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/library', libraryRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/personas', personasRoutes);
  app.use('/api/journeys', journeysRoutes);
  app.use('/api/metrics', metricsRoutes);
  app.use('/api/onboarding', onboardingRoutes);
  app.use('/api/experiments', experimentsRoutes);

  // In production mode, serve static files and handle SPA routing
  // This must come before notFoundHandler
  if (process.env.NODE_ENV === 'production') {
    const path = require('path');
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(__dirname, '../dist', 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
