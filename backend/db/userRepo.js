const { query } = require('./pool');

async function createUser({ email, passwordHash, displayName }) {
  const { rows } = await query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, persona, onboarded_at, created_at`,
    [email.toLowerCase().trim(), passwordHash, displayName || null]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(
    `SELECT id, email, display_name, persona, onboarded_at, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function setPersona(userId, persona) {
  const { rows } = await query(
    `UPDATE users SET persona = $2 WHERE id = $1 RETURNING id, persona`,
    [userId, persona]
  );
  return rows[0] || null;
}

async function markOnboarded(userId) {
  await query(`UPDATE users SET onboarded_at = now() WHERE id = $1`, [userId]);
}

module.exports = { createUser, findByEmail, findById, setPersona, markOnboarded };
