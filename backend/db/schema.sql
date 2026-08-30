-- OmniStream persistent schema
-- Replaces backend/store/memoryStore.js
--
-- Design notes (see docs/architecture.md for full rationale):
--   * pgvector stores content embeddings directly alongside relational data --
--     avoids running a second database for a catalog this size (tens of
--     thousands of items). Re-evaluate a dedicated vector DB (Qdrant/Weaviate)
--     only if the catalog or QPS grows past what a single Postgres instance
--     comfortably serves (see docs/architecture.md, "pgvector vs dedicated vector DB").
--   * embedding dimension is 384 to match Xenova/all-MiniLM-L6-v2 (the model
--     already used by backend/services/embeddingService.js).
--   * every table that is queried by user_id or content_id in the hot path
--     has an index for it -- these are exactly the lookups the recommender
--     does on every request.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    persona       TEXT,                    -- selected persona id, nullable
    is_simulated  BOOLEAN NOT NULL DEFAULT false, -- true for synthetic users created by
                                                    -- scripts/simulate/generateInteractions.js
                                                    -- (CF/eval training signal, not real people)
    onboarded_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT (the catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS content (
    id           TEXT PRIMARY KEY,          -- stable external/content id, e.g. "movie_19995"
    domain       TEXT NOT NULL,             -- 'movie' | 'video' | 'music' | 'podcast' | 'news'
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    thumbnail    TEXT,
    url          TEXT,
    duration     TEXT,
    rating       REAL,                      -- 0..5 (normalized at ingestion time)
    popularity   REAL,                      -- 0..100 (normalized at ingestion time)
    source       TEXT,                      -- provenance, e.g. 'tmdb', 'synthetic-generator'
    tags         TEXT[] NOT NULL DEFAULT '{}',
    topic        TEXT,
    mood         TEXT,
    intent       TEXT,
    format       TEXT,
    language     TEXT,
    embedding    vector(384),               -- precomputed at ingestion, NOT at request time
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_domain ON content (domain);
CREATE INDEX IF NOT EXISTS idx_content_topic ON content (topic);
CREATE INDEX IF NOT EXISTS idx_content_popularity ON content (popularity DESC);
CREATE INDEX IF NOT EXISTS idx_content_tags_gin ON content USING GIN (tags);

-- ANN index for semantic retrieval. HNSW over cosine distance --
-- see docs/architecture.md for the brute-force vs HNSW benchmark.
-- Built AFTER bulk ingestion (index-then-load is slow; load-then-index is fast).
-- vector_cosine_ops requires pgvector >= 0.5.0 (we have 0.6.0).
CREATE INDEX IF NOT EXISTS idx_content_embedding_hnsw
    ON content USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- ============================================================
-- INTERACTIONS (the event log -- source of truth for everything
-- downstream: user profile features, CF training data, offline eval)
-- ============================================================
CREATE TABLE IF NOT EXISTS interactions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('impression','open','like','unlike','skip','search')),
    weight     REAL NOT NULL,               -- resolved event weight at write time (see userModelService)
    context    JSONB,                       -- free-form: query string for 'search', session id, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interactions_user_time ON interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_content ON interactions (content_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user_content ON interactions (user_id, content_id);

-- ============================================================
-- PREFERENCES (from onboarding / settings, per domain)
-- ============================================================
CREATE TABLE IF NOT EXISTS preferences (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain     TEXT NOT NULL,
    data       JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, domain)
);

-- ============================================================
-- RECOMMENDATION EVENTS (what we served, for offline eval + A/B analysis)
-- Distinct from `interactions`: this logs what the ranker SHOWED,
-- interactions logs what the user DID. Joining the two is how you
-- compute CTR/like-rate per experiment variant.
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_events (
    id             BIGSERIAL PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_id     TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    rank           INT NOT NULL,             -- position in the returned list, 0-indexed
    experiment     TEXT,                     -- e.g. 'ranking_v2', null if no experiment active
    variant        TEXT,                     -- 'control' | 'treatment'
    candidate_source TEXT,                   -- 'semantic' | 'cf' | 'trending' | 'recent' | 'cold_start'
    score          REAL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reco_events_user_time ON recommendation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reco_events_experiment ON recommendation_events (experiment, variant);

-- ============================================================
-- EXPERIMENT ASSIGNMENTS (deterministic A/B bucketing, persisted
-- so a user doesn't flip variants between requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS experiment_assignments (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    experiment TEXT NOT NULL,
    variant    TEXT NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, experiment)
);

-- ============================================================
-- ANALYTICS EVENTS (arbitrary, not-necessarily-content-scoped events --
-- e.g. search-topic summaries, page views. Distinct from `interactions`,
-- which is specifically the content-interaction event log that drives
-- the recommender and requires a valid content_id.)
-- ============================================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event      TEXT NOT NULL,
    data       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_time ON analytics_events (user_id, created_at DESC);

-- ============================================================
-- Housekeeping
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_content_updated_at ON content;
CREATE TRIGGER trg_content_updated_at BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
