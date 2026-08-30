"""
ml/common.py -- shared data loading, feature engineering, and the
leave-last-positive-interaction-out temporal split used by both
ml/train_ranker.py and ml/evaluate.py.

Split protocol (documented so the split is reproducible and auditable):
  - For each user, sort their positive interactions (open/like) by time.
  - The LAST positive interaction becomes that user's held-out test item.
  - Every other interaction (for every user) is TRAIN.
  - Users with fewer than MIN_POSITIVES_FOR_EVAL positive interactions are
    excluded from evaluation (too little signal to hold one out) but their
    interactions still contribute to TRAIN.
  - Content-affinity profiles and CF factors used at evaluation time are
    both rebuilt from TRAIN ONLY -- this is what prevents label leakage
    (without this, "recall" would trivially include information about the
    very item being predicted).
"""
import os
import numpy as np
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

MIN_POSITIVES_FOR_EVAL = 3
POSITIVE_EVENTS = {"open", "like"}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def load_all_interactions(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT user_id::text AS user_id, content_id, event_type, weight, created_at
        FROM interactions
        ORDER BY created_at ASC
    """)
    rows = cur.fetchall()
    cur.close()
    return rows


def load_content(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT id, domain, topic, format, language, rating, popularity, embedding, created_at
        FROM content
    """)
    rows = cur.fetchall()
    cur.close()
    by_id = {}
    for r in rows:
        emb = r["embedding"]
        if emb is not None:
            emb = np.array([float(x) for x in emb.strip("[]").split(",")], dtype=np.float32)
        by_id[r["id"]] = {**r, "embedding": emb}
    return by_id


def temporal_split(interactions):
    """Returns (train_rows, test_pairs) where test_pairs = [(user_id, held_out_content_id)]."""
    by_user = {}
    for r in interactions:
        by_user.setdefault(r["user_id"], []).append(r)

    train_rows = []
    test_pairs = []

    for user_id, rows in by_user.items():
        positives = [r for r in rows if r["event_type"] in POSITIVE_EVENTS]
        positives.sort(key=lambda r: r["created_at"])

        if len(positives) >= MIN_POSITIVES_FOR_EVAL:
            held_out = positives[-1]
            test_pairs.append((user_id, held_out["content_id"]))
            held_out_key = (held_out["content_id"], held_out["created_at"])
            for r in rows:
                if (r["content_id"], r["created_at"]) == held_out_key and r["event_type"] in POSITIVE_EVENTS:
                    continue  # exclude exactly the held-out row from TRAIN
                train_rows.append(r)
        else:
            train_rows.extend(rows)

    return train_rows, test_pairs


def build_user_profiles(train_rows, half_life_days=14):
    """Per-user topic/domain affinity, time-decayed -- mirrors backend/services/userModelService.js."""
    import time as _t
    now = _t.time()

    profiles = {}
    for r in train_rows:
        if not r["weight"]:
            continue
        uid = r["user_id"]
        profiles.setdefault(uid, {"topic": {}, "domain": {}})
        age_days = max(0.0, (now - r["created_at"].timestamp()) / 86400.0)
        recency = 0.5 ** (age_days / half_life_days)
        delta = r["weight"] * recency
        # topic/domain come from a join at query time in real usage; here the
        # caller passes rows already joined with content (see evaluate.py)
        if r.get("topic"):
            profiles[uid]["topic"][r["topic"]] = profiles[uid]["topic"].get(r["topic"], 0) + delta
        if r.get("domain"):
            profiles[uid]["domain"][r["domain"]] = profiles[uid]["domain"].get(r["domain"], 0) + delta

    # normalize each user's vectors by max-abs, like the JS version
    for uid, v in profiles.items():
        for key in ("topic", "domain"):
            m = v[key]
            if not m:
                continue
            max_abs = max(abs(x) for x in m.values()) or 1
            for k in m:
                m[k] = m[k] / max_abs
    return profiles


def cosine(a, b):
    if a is None or b is None:
        return 0.0
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
    return float(np.dot(a, b) / denom)


def build_user_embedding(train_rows, content_by_id, half_life_days=14):
    """Weighted average of positively-interacted items' embeddings, per user (mirrors candidateGeneration.js)."""
    import time as _t
    now = _t.time()
    acc = {}
    weight_sum = {}
    for r in train_rows:
        if r["weight"] <= 0:
            continue
        item = content_by_id.get(r["content_id"])
        if not item or item["embedding"] is None:
            continue
        uid = r["user_id"]
        age_days = max(0.0, (now - r["created_at"].timestamp()) / 86400.0)
        recency = 0.5 ** (age_days / half_life_days)
        w = r["weight"] * recency
        if uid not in acc:
            acc[uid] = np.zeros_like(item["embedding"], dtype=np.float64)
            weight_sum[uid] = 0.0
        acc[uid] += item["embedding"] * w
        weight_sum[uid] += abs(w)

    return {uid: (acc[uid] / weight_sum[uid]) for uid in acc if weight_sum[uid] > 0}
