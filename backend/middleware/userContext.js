function userContext(req, _res, next) {
  const headerId = req.header('x-user-id');
  const queryId = req.query?.userId;
  const raw = headerId || queryId || 'demo';
  req.userId = String(raw);
  next();
}

module.exports = { userContext };
