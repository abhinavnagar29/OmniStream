const { logger } = require('../logger');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err && err.status && Number.isInteger(err.status) ? err.status : 500;

  // Anything that reaches here as a 500 is unexpected -- always log it,
  // regardless of environment, so it's visible in production too (this is
  // deliberately separate from pino-http's request-completion log, which
  // only shows the final status code, not the underlying error/stack).
  if (status >= 500) {
    logger.error({ err, path: req?.originalUrl, method: req?.method }, 'unhandled request error');
  }

  const payload = {
    error: {
      message: (err && err.message) || 'Internal Server Error',
    },
  };

  if (err && err.details) {
    payload.error.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && err && err.stack) {
    payload.error.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { ApiError, notFoundHandler, errorHandler };
