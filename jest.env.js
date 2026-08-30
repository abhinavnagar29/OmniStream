// Runs before the test framework is set up, in each test file's process --
// points the app at the isolated test database instead of dev.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://omnistream:omnistream_dev_pw@localhost:5432/omnistream_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
// Generous default so the main functional test suite (which makes dozens of
// requests) never trips the rate limiter incidentally. The dedicated
// rate-limit test overrides these to a tight window before requiring the
// app, in its own test file (each Jest test file gets its own module
// registry, so this override never leaks into other files).
process.env.RATE_LIMIT_MAX = process.env.RATE_LIMIT_MAX || '10000';
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '60000';
