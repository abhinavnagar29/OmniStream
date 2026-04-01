const { ZodError } = require('zod');
const { ApiError } = require('./errors');

function validate({ query, params, body }) {
  return (req, _res, next) => {
    try {
      if (query) req.query = query.parse(req.query);
      if (params) req.params = params.parse(req.params);
      if (body) req.body = body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new ApiError(400, 'Validation error', {
            issues: err.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          })
        );
      }
      next(err);
    }
  };
}

module.exports = { validate };
