const { query } = require('./pool');

async function add(userId, event, data) {
  const { rows } = await query(
    `INSERT INTO analytics_events (user_id, event, data) VALUES ($1,$2,$3) RETURNING id, user_id AS "userId", event, data, created_at AS "at"`,
    [userId, event, data !== undefined ? JSON.stringify(data) : null]
  );
  return rows[0];
}

async function forUser(userId, { limit = 500 } = {}) {
  const { rows } = await query(
    `SELECT id, user_id AS "userId", event, data, created_at AS "at" FROM analytics_events
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

module.exports = { add, forUser };
