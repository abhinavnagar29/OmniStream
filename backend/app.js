const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { userContext } = require('./middleware/userContext');
const healthRoutes = require('./routes/health');
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

function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use(userContext);

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use('/api/health', healthRoutes);
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
