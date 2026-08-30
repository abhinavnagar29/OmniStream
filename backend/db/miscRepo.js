const { query } = require('./pool');
const crypto = require('crypto');

// ---------- Preferences ----------
async function getPreferences(userId) {
  const { rows } = await query(`SELECT domain, data FROM preferences WHERE user_id = $1`, [userId]);
  const out = {};
  for (const r of rows) out[r.domain] = r.data;
  return out;
}

async function setDomainPreferences(userId, domain, prefs) {
  const { rows } = await query(
    `INSERT INTO preferences (user_id, domain, data)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, domain) DO UPDATE SET data = preferences.data || $3, updated_at = now()
     RETURNING data`,
    [userId, domain, JSON.stringify(prefs)]
  );
  return rows[0].data;
}

// ---------- Recommendation events (what we served) ----------
async function logServed(userId, items /* [{contentId, rank, candidateSource, score}] */, experiment = null, variant = null) {
  if (!items.length) return;
  const values = [];
  const params = [];
  items.forEach((it, i) => {
    const base = i * 7;
    values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7})`);
    params.push(userId, it.contentId, it.rank, experiment, variant, it.candidateSource || null, it.score ?? null);
  });
  await query(
    `INSERT INTO recommendation_events (user_id, content_id, rank, experiment, variant, candidate_source, score)
     VALUES ${values.join(',')}`,
    params
  );
}

// ---------- Experiment assignment (deterministic bucketing) ----------
function bucketFor(userId, experiment, variants = ['control', 'treatment']) {
  const hash = crypto.createHash('sha256').update(`${experiment}:${userId}`).digest();
  const n = hash.readUInt32BE(0);
  const idx = n % variants.length;
  return variants[idx];
}

async function getOrAssignVariant(userId, experiment, variants = ['control', 'treatment']) {
  const { rows } = await query(
    `SELECT variant FROM experiment_assignments WHERE user_id = $1 AND experiment = $2`,
    [userId, experiment]
  );
  if (rows[0]) return rows[0].variant;

  const variant = bucketFor(userId, experiment, variants);
  await query(
    `INSERT INTO experiment_assignments (user_id, experiment, variant)
     VALUES ($1,$2,$3) ON CONFLICT (user_id, experiment) DO NOTHING`,
    [userId, experiment, variant]
  );
  return variant;
}

module.exports = { getPreferences, setDomainPreferences, logServed, bucketFor, getOrAssignVariant };
