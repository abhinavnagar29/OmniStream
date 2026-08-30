# Deploying OmniStream

Two real paths, both using genuinely free tiers (verified current as of Aug 2026 — always double-check pricing pages before committing, free tiers change). Start with **Path A** — it's simpler and gets you a live URL fastest. Move to **Path B** later if you want a custom frontend domain or faster global static delivery.

No platform in either path requires a credit card to start.

## What you need, and why

| Service | What it does here | Why not something else |
|---|---|---|
| **Neon** (neon.tech) | Postgres + pgvector | Real, permanent free tier (0.5GB storage, 100 compute-hrs/mo), pgvector supported on every plan with no add-on. Render's own free Postgres expires after a limited period — not a fit for a project you want to keep alive. |
| **Upstash** (upstash.com) | Redis | Real, permanent free tier (256MB, 500K commands/mo), no card required. Render has no free Redis tier at all (starts at $10/mo). |
| **Render** (render.com) | Backend (Docker) | Free web service tier (750 instance-hours/mo — enough for one always-attempted service), deploys straight from your `Dockerfile`, no card required. **Caveat:** free web services sleep after 15 minutes of inactivity and take 30-60s to wake up on the next request — fine for a portfolio project, not for a "must always be instantly responsive" demo. |
| **Vercel** (vercel.com) *(Path B only)* | Frontend (static build) | Free Hobby tier, genuinely free for personal/non-commercial projects, global CDN, no card required. |

---

## Path A — single service (simplest, do this first)

The backend already knows how to serve the built frontend itself (see `server.js` — `NODE_ENV=production` serves `dist/`). One Render service, no CORS to configure, one URL.

### 1. Database — Neon

1. Sign up at neon.tech, create a project.
2. Open the SQL Editor (or `psql` with the connection string Neon gives you) and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
3. Copy the connection string Neon shows you (starts `postgresql://...`). This is your `DATABASE_URL`.

### 2. Redis — Upstash

1. Sign up at upstash.com, create a Redis database (pick a region close to where you'll deploy Render).
2. Copy the **TCP** connection string (not the REST URL) — it looks like `rediss://default:PASSWORD@HOST:PORT`. `ioredis` (what this project uses) handles `rediss://` (TLS) natively — no code changes needed. This is your `REDIS_URL`.

### 3. Backend + frontend — Render

1. Push this repo to GitHub if it isn't already.
2. On Render: **New → Web Service**, connect the repo.
3. Environment: **Docker** (it'll auto-detect the `Dockerfile` — it's a multi-stage build that builds both the frontend and backend into one image, so nothing else to configure here).
4. Set environment variables in Render's dashboard:
   ```
   DATABASE_URL=<your Neon connection string>
   REDIS_URL=<your Upstash rediss:// connection string>
   JWT_SECRET=<run `openssl rand -hex 32` locally and paste the result>
   NODE_ENV=production
   PORT=5050
   ```
5. Deploy. Once it's live, open a **Shell** tab on the Render service (or run these locally against the same `DATABASE_URL`/one-off job) and run:
   ```bash
   npm run db:migrate
   npm run ingest
   ```
   This creates the schema and loads the real TMDB movie catalog + synthetic other-domain content, with embeddings.
6. `ml/models/*.json` (the pre-trained CF factors and ranker weights) are committed to this repo, so they deploy automatically with everything else — no extra step needed.

That's it — your app is live at `https://<your-service>.onrender.com`, backend and frontend on the same origin, no CORS configuration required.

---

## Path B — split frontend/backend (nicer, do this once Path A works)

Same Neon + Upstash setup as above, but:

- **Render** hosts only the backend (revert the Dockerfile change from Path A — go back to the checked-in version that ships backend only).
- **Vercel** hosts the frontend separately, for a faster global CDN and a cleaner custom domain later.

### Backend (Render)
Same as Path A steps 1-4. The Dockerfile builds the frontend into the image regardless of which path you use — in a split deploy that copy just goes unused (Vercel serves the real one), which costs a little build time and nothing else. Add one more environment variable on the Render service:
```
CORS_ORIGIN=https://your-frontend.vercel.app
```
(comma-separate multiple origins if needed — see `backend/app.js`). Without this, CORS defaults to allow-all, which works but is looser than you want once this is genuinely public.

### Frontend (Vercel)
1. On Vercel: **New Project**, import the repo.
2. Framework preset: Vite. Build command `npm run build`, output directory `dist` (Vercel usually auto-detects both).
3. Add an environment variable:
   ```
   VITE_API_BASE_URL=https://your-backend.onrender.com/api
   ```
4. Deploy.

Now frontend and backend are on different domains, talking over CORS.

---

## Before you deploy — things to actually check first

- **Run the test suite against a real Postgres+Redis once more locally** (`npm test`) before deploying — it's fast, and it's your last real signal that nothing broke.
- **The async analytics worker (`scripts/worker/analyticsWorker.js`) needs to run as a long-lived process separate from the web server.** Render's free tier covers *web services*; whether background workers are included free depends on your current plan — check Render's pricing page for "Background Workers" before assuming. If it's not free, the app still works fully without it running: analytics events just queue in Redis Streams and get processed whenever you do run the worker (`npm run worker:analytics`), even manually/periodically. Nothing breaks by not running it continuously.
- **Free-tier cold starts are real.** Render's free web service sleeps after 15 minutes idle; the first request after that takes 30-60s. If you're demoing this live to someone (an interviewer, e.g.), hit the URL yourself a minute before the call.
- **`JWT_SECRET` must be a real secret, not `dev-only-secret-...` from the local `.env`.** Generate a fresh one for production: `openssl rand -hex 32`.
- **Movie thumbnails currently point at `picsum.photos` placeholder images** (see `scripts/ingest/movies.js` — this sandbox couldn't reach TMDB's real image CDN). They'll load fine in production since `picsum.photos` is a real public service, but if you want real movie posters, swap that line for TMDB's actual image API (`https://image.tmdb.org/t/p/w500{poster_path}` — the CSV has a `poster_path` column already, just unused).

## After deploying

Point `GET /<your-url>/api/health` at it — should return `{"status":"OK", "dependencies": {"database":"ok","redis":"ok",...}}`. If it says `DEGRADED`, that's the health check doing its job — check which dependency it's reporting as unreachable and start there.
