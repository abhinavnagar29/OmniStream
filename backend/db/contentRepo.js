const { query } = require('./pool');

function toVectorLiteral(embedding) {
  // pgvector accepts '[0.1,0.2,...]' text literal for the vector type
  return `[${embedding.join(',')}]`;
}

async function upsertContent(item) {
  const {
    id, domain, title, description, thumbnail, url, duration,
    rating, popularity, source, tags, topic, mood, intent, format, language, embedding,
  } = item;

  await query(
    `INSERT INTO content (id, domain, title, description, thumbnail, url, duration,
        rating, popularity, source, tags, topic, mood, intent, format, language, embedding)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
        domain=$2, title=$3, description=$4, thumbnail=$5, url=$6, duration=$7,
        rating=$8, popularity=$9, source=$10, tags=$11, topic=$12, mood=$13,
        intent=$14, format=$15, language=$16, embedding=$17`,
    [
      id, domain, title, description, thumbnail || null, url || null, duration || null,
      rating ?? null, popularity ?? null, source || null, tags || [], topic || null,
      mood || null, intent || null, format || null, language || null,
      embedding ? toVectorLiteral(embedding) : null,
    ]
  );
}

async function count() {
  const { rows } = await query(`SELECT COUNT(*)::int AS n FROM content`);
  return rows[0].n;
}

async function getById(id) {
  const { rows } = await query(`SELECT * FROM content WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function getByIds(ids) {
  if (!ids.length) return [];
  const { rows } = await query(`SELECT * FROM content WHERE id = ANY($1::text[])`, [ids]);
  return rows;
}

async function all({ domain, limit = 5000 } = {}) {
  if (domain) {
    const { rows } = await query(
      `SELECT * FROM content WHERE domain = $1 ORDER BY popularity DESC NULLS LAST LIMIT $2`,
      [domain, limit]
    );
    return rows;
  }
  const { rows } = await query(`SELECT * FROM content ORDER BY popularity DESC NULLS LAST LIMIT $1`, [limit]);
  return rows;
}

/**
 * Approximate nearest-neighbor semantic retrieval via pgvector HNSW index.
 * `<=>` is cosine distance in pgvector; smaller = more similar.
 * This is the "Stage 1: candidate generation" semantic source.
 */
async function findSimilarByVector(embedding, { limit = 200, excludeIds = [], domain = null } = {}) {
  const vec = toVectorLiteral(embedding);
  const params = [vec];
  let sql = `SELECT *, 1 - (embedding <=> $1) AS similarity FROM content WHERE embedding IS NOT NULL`;

  if (excludeIds.length) {
    params.push(excludeIds);
    sql += ` AND id != ALL($${params.length}::text[])`;
  }
  if (domain) {
    params.push(domain);
    sql += ` AND domain = $${params.length}`;
  }
  params.push(limit);
  sql += ` ORDER BY embedding <=> $1 LIMIT $${params.length}`;

  const { rows } = await query(sql, params);
  return rows;
}

async function trending({ limit = 200, domain = null } = {}) {
  const params = [limit];
  let sql = `SELECT * FROM content`;
  if (domain) {
    sql += ` WHERE domain = $2`;
    params.push(domain);
  }
  sql += ` ORDER BY popularity DESC NULLS LAST, rating DESC NULLS LAST LIMIT $1`;
  const { rows } = await query(sql, params);
  return rows;
}

async function search(term, { limit = 50 } = {}) {
  const { rows } = await query(
    `SELECT * FROM content
     WHERE title ILIKE $1 OR description ILIKE $1 OR $2 = ANY(tags)
     ORDER BY popularity DESC NULLS LAST LIMIT $3`,
    [`%${term}%`, term.toLowerCase(), limit]
  );
  return rows;
}

module.exports = {
  upsertContent, count, getById, getByIds, all,
  findSimilarByVector, trending, search, toVectorLiteral,
};
