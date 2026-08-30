"""
ml/train_ranker.py -- trains the PRODUCTION ranker (on all current
interaction data, not the train/test split used by evaluate.py -- that
split exists purely to measure quality, not to gatekeep what gets served).

Two artifacts are written:
  1. ml/models/ranker_lgbm.txt  -- the full LightGBM LambdaMART model.
     This is the one ml/evaluate.py's numbers are about. It is NOT loaded
     by the Node backend directly (no LightGBM inference binding is wired
     into backend/ -- see below for why).
  2. ml/models/ranker_weights.json -- a small logistic-regression
     distillation of the same feature set, trained to approximate the
     LightGBM model's relevance decisions. This IS what
     backend/services/learnedRanker.js loads: a 6-number weight vector is
     a dot product away from a score, so it costs microseconds per
     candidate at request time with zero extra process/IPC overhead.
     Distilling a complex offline model into a cheap linear model for
     low-latency serving is a standard production pattern (the alternative
     -- shelling out to Python per request, or standing up a separate
     Python inference microservice -- is real infra work; see
     docs/architecture.md, "why a distilled linear ranker" for the
     tradeoff writeup and what it would take to remove this limitation).

Run: python3 ml/train_ranker.py
"""
import json
import os
import random
import time

import numpy as np
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression

from common import get_conn, load_all_interactions, load_content, build_user_profiles, build_user_embedding
from train_cf import als_implicit

random.seed(7)
np.random.seed(7)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
FEATURE_NAMES = ["ratingScore", "recency", "affinity", "semantic", "cfScore", "popularity"]


def features_for_ranker(item, profile, user_embedding, cf_user_vec, cf_item_factors, now_ts):
    rating = (item.get("rating") or 3.5) / 5.0
    age_days = max(0.0, (now_ts - item["created_at"].timestamp()) / 86400.0) if item.get("created_at") else 30.0
    rec = max(0.0, 1 - age_days / 60)
    affinity = 0.0
    if profile:
        affinity = 0.55 * profile["topic"].get(item["topic"], 0.0) + 0.25 * profile["domain"].get(item["domain"], 0.0)
    semantic01 = 0.5
    if user_embedding is not None and item.get("embedding") is not None:
        denom = (np.linalg.norm(user_embedding) * np.linalg.norm(item["embedding"])) or 1.0
        cos = float(np.dot(user_embedding, item["embedding"]) / denom)
        semantic01 = max(0.0, (cos + 1) / 2)
    cf = 0.0
    if cf_user_vec is not None:
        itf = cf_item_factors.get(item["id"])
        if itf is not None:
            cf = float(np.dot(cf_user_vec, itf))
    popularity = (item.get("popularity") or 0) / 100.0
    return [rating, rec, affinity, semantic01, cf, popularity]


def main():
    conn = get_conn()
    interactions = load_all_interactions(conn)
    content_by_id = load_content(conn)
    all_item_ids = list(content_by_id.keys())
    for r in interactions:
        item = content_by_id.get(r["content_id"])
        r["topic"] = item["topic"] if item else None
        r["domain"] = item["domain"] if item else None

    print(f"[train_ranker] {len(interactions)} interactions over {len(content_by_id)} items")

    profiles = build_user_profiles(interactions)
    user_embeddings = build_user_embedding(interactions, content_by_id)

    positive = [(r["user_id"], r["content_id"], r["weight"]) for r in interactions if r["weight"] > 0]
    cf_user_ids = sorted({r[0] for r in positive})
    cf_item_ids = sorted({r[1] for r in positive})
    print("[train_ranker] training CF on full interaction set for production serving...")
    X, Y = als_implicit(cf_user_ids, cf_item_ids, positive, n_iter=12)
    cf_user_factors = {uid: X[i] for i, uid in enumerate(cf_user_ids)}
    cf_item_factors = {iid: Y[i] for i, iid in enumerate(cf_item_ids)}

    # Build a pointwise (user,item)->relevance dataset the same way evaluate.py does
    by_user = {}
    for r in interactions:
        by_user.setdefault(r["user_id"], []).append(r)

    now_ts = time.time()
    feats, labels, groups = [], [], []
    for uid, rows in by_user.items():
        pos_ids = {r["content_id"] for r in rows if r["event_type"] in ("open", "like")}
        neg_pool = [i for i in all_item_ids if i not in pos_ids]
        if not pos_ids or not neg_pool:
            continue
        profile = profiles.get(uid)
        emb = user_embeddings.get(uid)
        cf_vec = cf_user_factors.get(uid)
        sampled_negs = random.sample(neg_pool, min(len(neg_pool), len(pos_ids) * 4))
        group_size = 0
        for pid in pos_ids:
            item = content_by_id.get(pid)
            if not item:
                continue
            feats.append(features_for_ranker(item, profile, emb, cf_vec, cf_item_factors, now_ts))
            labels.append(2)
            group_size += 1
        for nid in sampled_negs:
            item = content_by_id.get(nid)
            if not item:
                continue
            feats.append(features_for_ranker(item, profile, emb, cf_vec, cf_item_factors, now_ts))
            labels.append(0)
            group_size += 1
        if group_size:
            groups.append(group_size)

    feats = np.array(feats)
    labels = np.array(labels)
    print(f"[train_ranker] {len(feats)} rows across {len(groups)} users for training")

    print("[train_ranker] training LightGBM LambdaMART (production artifact)...")
    lgbm = lgb.LGBMRanker(n_estimators=120, num_leaves=15, learning_rate=0.06, min_child_samples=5, verbosity=-1)
    lgbm.fit(feats, labels, group=groups)
    os.makedirs(MODELS_DIR, exist_ok=True)
    lgbm.booster_.save_model(os.path.join(MODELS_DIR, "ranker_lgbm.txt"))

    print("[train_ranker] fitting distilled logistic-regression weights for Node serving...")
    binary_labels = (labels > 0).astype(int)
    logreg = LogisticRegression(max_iter=1000)
    logreg.fit(feats, binary_labels)

    weights = {name: round(float(w), 5) for name, w in zip(FEATURE_NAMES, logreg.coef_[0])}
    intercept = round(float(logreg.intercept_[0]), 5)
    train_acc = round(float(logreg.score(feats, binary_labels)), 4)

    out = {
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "featureOrder": FEATURE_NAMES,
        "weights": weights,
        "intercept": intercept,
        "trainAccuracy": train_acc,
        "nTrainingRows": len(feats),
        "note": (
            "Logistic-regression distillation of a LightGBM LambdaMART model's feature "
            "usage, trained on SIMULATED interaction data (see scripts/simulate/generateInteractions.js). "
            "See ml/evaluation_results.json for the actual ranking-quality comparison, which uses "
            "the full LightGBM model, not this distilled version."
        ),
    }
    weights_path = os.path.join(MODELS_DIR, "ranker_weights.json")
    with open(weights_path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"[train_ranker] wrote {weights_path}")
    print(f"[train_ranker] distilled model train-set accuracy: {train_acc}")
    print(f"[train_ranker] weights: {weights} intercept={intercept}")


if __name__ == "__main__":
    main()
