const { verifyToken } = require('../services/authService');

/** Requires a valid JWT. Sets req.userId and req.userEmail. */
function requireAuth(req, res, next) {
  const header = req.header('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Attaches req.userId if a valid token is present, but does not reject the request otherwise. */
function optionalAuth(req, _res, next) {
  const header = req.header('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      req.userId = payload.sub;
      req.userEmail = payload.email;
    } catch {
      /* ignore invalid token in optional mode */
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
