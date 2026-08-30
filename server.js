const express = require('express');
const path = require('path');
require('dotenv').config();

const { createApp } = require('./backend/app');
const { logger } = require('./backend/logger');
const db = require('./backend/db/pool');
const { redis } = require('./backend/db/redis');

// ---- Process-level safety nets ----
// Without these, an unhandled promise rejection anywhere in the app (a
// missed .catch(), a forgotten await) silently does nothing in older Node
// versions or crashes the process ungracefully in newer ones. Logging them
// explicitly means "no errors should be there" is something we can actually
// verify by checking logs, not just something we hope is true.
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception -- exiting');
  // An uncaught synchronous exception means the process is in an unknown
  // state; exiting (and letting a process manager restart it) is safer
  // than continuing to serve requests from a potentially corrupted state.
  process.exit(1);
});

const app = createApp();
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ---- Graceful shutdown ----
// Stops accepting new connections, lets in-flight requests finish, then
// closes the DB pool and Redis connection cleanly instead of dropping them.
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(async () => {
    try {
      await db.pool.end();
      redis.disconnect();
      logger.info('Shutdown complete.');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  });

  // Force-exit if graceful shutdown hangs (e.g. a stuck connection)
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
