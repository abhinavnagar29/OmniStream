# OmniStream — Architecture

## Why PostgreSQL + pgvector (not a separate vector DB)

At this catalog size (1.5-2K items, could scale to low hundreds of thousands
before this becomes a real constraint) a dedicated vector database (Qdrant,
Weaviate, Pinecone) adds an operational dependency without a benefit pgvector
doesn't already provide: HNSW ANN search, filtering by metadata in the same
query, and no cross-database consistency problem between "the item" and "the
item's embedding." The tradeoff flips once you need to shard vector search
independently of the relational data, or need features specific to a vector
DB (e.g. server-side quantization at massive scale, multi-tenant namespace
isolation as a first-class primitive). That's a real, deliberate future
migration point, not a mistake made now.

## Why raw `pg` instead of an ORM

Originally planned Prisma. Its query/schema engine binaries are fetched from
`binaries.prisma.sh` at install/generate time, which is not a reachable
domain in this build's sandboxed network. Pivoted to `pg` + hand-written SQL
in `backend/db/*Repo.js`. This isn't purely a workaround: pgvector's `<=>`
operator and HNSW index tuning are more naturally expressed in raw SQL than
through most ORMs' query builders anyway, so the "downgrade" costs less than
it might elsewhere. A real deployment with unrestricted internet access could
reintroduce Prisma (or Drizzle) as a thin layer over the same schema without
changing `backend/db/schema.sql`.

## Two-stage recommender: candidate generation vs. ranking

`backend/services/candidateGeneration.js` (Stage 1) pulls from four
independent, cheap-to-compute sources — semantic ANN, collaborative
filtering, trending, cold-start — and merges them into a duplicate-free pool
of a few hundred items. `backend/services/ranking.js` (Stage 2) is the only
place that decides what's actually relevant to *this* user, scoring the
merged pool with a heuristic formula optionally blended with a learned model.

Keeping these separate (rather than one function that both retrieves and
scores, which is what the original in-memory version did) is what makes each
half independently testable, and mirrors the architecture used at YouTube,
Pinterest, and Netflix for exactly the reason those companies describe in
their public engineering writeups: retrieval needs to be fast and can afford
to be approximate; ranking can afford to be expensive because it only runs on
a few hundred candidates, not the whole catalog.

## Why collaborative filtering, and the data-provenance caveat

`ml/train_cf.py` trains implicit-feedback ALS (Hu, Koren & Volinsky 2008) —
confidence-weighted matrix factorization suited to implicit signals
(opens/likes/skips), not the explicit 1-5 star ratings that plain SVD
assumes. The **training data behind it is simulated**
(`scripts/simulate/generateInteractions.js`) because this project has no real
user base yet. The math and the serving path are real and will work
unchanged the moment real interaction rows exist in the `interactions`
table — nothing about the CF pipeline knows or cares that today's rows are
synthetic. This is called out explicitly in three places in the codebase
(`cfService.js`, the simulator script, and here) so nobody mistakes a
demo-quality signal for a production one.

## Why LightGBM LambdaMART for ranking, and why a distilled linear model is what's actually served

`ml/evaluate.py` and `ml/train_ranker.py` train a real LightGBM `LGBMRanker`
(LambdaMART, directly optimizes nDCG) — this is what the numbers in
`ml/evaluation_results.json` are about. The Node backend does not shell out
to Python per request (that's real, avoidable latency and an extra failure
mode for a request path that needs to stay fast). Instead,
`ml/train_ranker.py` also fits a 6-weight logistic regression on the same
features and exports it as JSON; `backend/services/learnedRanker.js` loads
that and does a dot product at request time. This is a standard
train-complex/serve-simple pattern. The honest cost: the served model is a
linear approximation of the LightGBM model's decisions, not the LightGBM
model itself. A production system with a live feature-serving story would
either run LightGBM's C++ inference library directly in-process (there are
Node bindings) or stand up a small model-serving microservice — both are
real infra work intentionally out of scope here.

## MMR diversity re-ranking

`backend/services/diversityService.js` — greedy selection that penalizes
picking another item from a topic/domain already well-represented in the
list so far: `adjustedScore = relevanceScore - λ * redundancy`. `λ` (the
`explore` parameter) is exposed as a request-time knob rather than hardcoded,
and `ml/evaluate.py`'s `hybrid_plus_ranker_mmr` row is exactly this
relevance/diversity trade-off measured, not assumed — see
`ml/evaluation_results.json` for the actual number: topic entropy went up
while nDCG@10 moved by less than a rounding error in the run recorded there,
which is the trade-off working as intended.

## Caching and invalidation

Redis caches the ranked recommendation list per `(userId, query-params)` for
120 seconds (`backend/db/redis.js`). It's invalidated on `like`, `unlike`,
`open`, and `skip` — the events that actually change what the profile looks
like — but **not** on `impression`, so scrolling through a feed doesn't
cache-bust itself. Cache is treated as a pure optimization everywhere it's
touched: every cache read/write is wrapped in try/catch that falls through
to computing fresh, so a Redis outage degrades latency, not correctness.

## Async event logging

Feedback and analytics writes happen inline in the request today (simple,
correct, low enough volume at current scale to not matter). The explicit
next step, not yet implemented, is moving `analyticsRepo.add` /
`interactionRepo.record` off the request's critical path via Redis Streams
or a small queue, so a slow write to the event log can never slow down the
response the user is waiting on. Flagged here rather than built because it's
not yet a measured bottleneck — see Limitations in the final report for why
this is prioritized below the items that were built.

## Failure handling / what happens if a dependency is down

- **Redis down**: `db/redis.js` catches every operation; recommendations
  compute fresh every time (slower, still correct).
- **CF model missing** (`ml/models/cf_factors.json` absent): `cfService.js`
  returns no candidates from that source; semantic + trending candidates
  still serve. `GET /api/health` reports this explicitly.
- **Learned ranker missing**: `learnedRanker.isAvailable()` returns false;
  `ranking.js` uses the pure heuristic score. Also reported by `/api/health`.
- **Postgres down**: the app cannot serve authenticated requests (this is a
  hard dependency, correctly so — there is no meaningful cached fallback for
  "who is this user").

## Scalability notes (honest, not aspirational)

The API is stateless (JWT auth, no server-side session) so it can run behind
a load balancer with multiple instances without any code change — this
wasn't tested with multiple instances in this environment, but nothing in
the design assumes a single instance (rate limiting is the one exception:
it's currently process-local via `express-rate-limit`'s default memory
store, which does *not* share state across instances — moving it to a
Redis-backed store is a one-line config change, not yet made, and is listed
as a known limitation rather than silently left broken).
