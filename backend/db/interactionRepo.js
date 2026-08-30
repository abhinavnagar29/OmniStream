const { query } = require('./pool');

const EVENT_WEIGHTS = {
  like: 3,
  unlike: -3,
  open: 1,
  skip: -2,
  impression: 0.05,
  search: 0.2,
};

async function record(userId, contentId, eventType, context = null) {
  const weight = EVENT_WEIGHTS[eventType] ?? 0;
  const { rows } = await query(
    `INSERT INTO interactions (user_id, content_id, event_type, weight, context)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [userId, contentId, eventType, weight, context ? JSON.stringify(context) : null]
  );
  return rows[0];
}

async function recordMany(events) {
  // events: [{userId, contentId, eventType, context}]
  if (!events.length) return;
  const values = [];
  const params = [];
  events.forEach((e, i) => {
    const base = i * 5;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`);
    params.push(e.userId, e.contentId, e.eventType, EVENT_WEIGHTS[e.eventType] ?? 0, e.context ? JSON.stringify(e.context) : null);
  });
  await query(
    `INSERT INTO interactions (user_id, content_id, event_type, weight, context) VALUES ${values.join(',')}`,
    params
  );
}

/** Recent, time-decayed interactions for a user -- feeds userModelService. */
async function recentForUser(userId, { limit = 200 } = {}) {
  const { rows } = await query(
    `SELECT i.*, c.domain, c.topic, c.tags, c.mood
     FROM interactions i JOIN content c ON c.id = i.content_id
     WHERE i.user_id = $1
     ORDER BY i.created_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

async function likedContentIds(userId) {
  const { rows } = await query(
    `SELECT content_id FROM interactions
     WHERE user_id = $1 AND event_type = 'like'
       AND content_id NOT IN (
         SELECT content_id FROM interactions WHERE user_id = $1 AND event_type = 'unlike'
           AND created_at > (SELECT COALESCE(MAX(created_at), 'epoch') FROM interactions
                              WHERE user_id = $1 AND event_type = 'like' AND content_id = interactions.content_id)
       )`,
    [userId]
  );
  return rows.map((r) => r.content_id);
}

/** All interactions across all users -- used for offline CF training / evaluation. */
async function allForTraining() {
  const { rows } = await query(
    `SELECT user_id, content_id, event_type, weight, created_at FROM interactions ORDER BY created_at ASC`
  );
  return rows;
}

async function countForUser(userId) {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM interactions WHERE user_id = $1`, [userId]);
  return rows[0].n;
}

/** Aggregated implicit-feedback score per content item -- sum of event weights. */
async function getScoresMap(userId) {
  const { rows } = await query(
    `SELECT content_id, SUM(weight)::real AS score FROM interactions WHERE user_id = $1 GROUP BY content_id`,
    [userId]
  );
  const m = new Map();
  for (const r of rows) m.set(r.content_id, Number(r.score));
  return m;
}

module.exports = {
  EVENT_WEIGHTS, record, recordMany, recentForUser, likedContentIds, allForTraining, countForUser, getScoresMap,
};
