"""
ml/evaluate.py -- the offline evaluation harness.

Protocol (see ml/common.py docstring for the full split rationale):
  1. Temporal, per-user leave-last-positive-out split.
  2. Rebuild user profiles, user embeddings, and CF factors from TRAIN ONLY
     (no leakage from the held-out test item).
  3. For each test user, build a candidate set = {held-out item} U
     {N_NEGATIVES random items they never interacted with}. This is the
     standard "sampled negatives" leave-one-out protocol used in recsys
     papers (e.g. He et al., Neural Collaborative Filtering, 2017) --
     ranking the full multi-thousand-item catalog for every user is not
     necessary to get a meaningful relative comparison between strategies,
     and keeps this runnable without a cluster.
  4. Rank that candidate set under each strategy, compute Precision@K,
     Recall@K, HitRate@K, nDCG@K, MAP@K, averaged over all test users.
  5. Compute diversity metrics (topic entropy, catalog coverage) on the
     top-10 lists each strategy actually returns.

Run: python3 ml/evaluate.py
Writes: ml/evaluation_results.json (machine-readable) and prints a
markdown table (human-readable, safe to paste into a README).

NEVER edit this file to hardcode results -- every number it prints comes
from the run that just happened, against whatever is in `interactions`
and `content` right now.
"""
import json
import math
import os
import random
import time

import numpy as np

from common import get_conn, load_all_interactions, load_content, temporal_split, cosine
from train_cf import als_implicit

random.seed(42)
np.random.seed(42)

K_VALUES = [5, 10]
N_NEGATIVES = 100
DIVERSITY_SAMPLE_USERS = 60


# ---------------------------------------------------------------------------
# Feature / scoring functions per strategy
# ---------------------------------------------------------------------------

def profile_affinity(profile, item):
    if not profile:
        return 0.0
    t = profile["topic"].get(item["topic"], 0.0)
    d = profile["domain"].get(item["domain"], 0.0)
    return 0.55 * t + 0.25 * d


def recency_score(item, now_ts):
    if not item.get("created_at"):
        return 0.5
    age_days = max(0.0, (now_ts - item["created_at"].timestamp()) / 86400.0)
    return max(0.0, 1 - age_days / 60)


def score_popularity(item, ctx):
    return (item.get("popularity") or 0) / 100.0


def score_content(item, ctx):
    return profile_affinity(ctx["profile"], item)


def score_cf(item, ctx):
    uid = ctx["user_id"]
    uf = ctx["cf_user_factors"].get(uid)
    itf = ctx["cf_item_factors"].get(item["id"])
    if uf is None or itf is None:
        return 0.0
    return float(np.dot(uf, itf))


def score_hybrid(item, ctx):
    rating = (item.get("rating") or 3.5) / 5.0
    rec = recency_score(item, ctx["now_ts"])
    affinity = profile_affinity(ctx["profile"], item)
    semantic = cosine(ctx["user_embedding"], item.get("embedding"))
    semantic01 = max(0.0, (semantic + 1) / 2)
    cf = score_cf(item, ctx)
    cf_boost = max(0.0, min(0.25, cf * 0.15))
    return 0.4 * rating + 0.25 * rec + affinity * 0.25 + semantic01 * 0.35 + cf_boost


def features_for_ranker(item, ctx):
    rating = (item.get("rating") or 3.5) / 5.0
    rec = recency_score(item, ctx["now_ts"])
    affinity = profile_affinity(ctx["profile"], item)
    semantic = cosine(ctx["user_embedding"], item.get("embedding"))
    semantic01 = max(0.0, (semantic + 1) / 2)
    cf = score_cf(item, ctx)
    popularity = (item.get("popularity") or 0) / 100.0
    return [rating, rec, affinity, semantic01, cf, popularity]


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def metrics_at_k(ranked_ids, relevant_id, k):
    top_k = ranked_ids[:k]
    hit = 1.0 if relevant_id in top_k else 0.0
    precision = hit / k
    recall = hit  # exactly one relevant item in the candidate set
    if hit:
        rank = top_k.index(relevant_id) + 1
        ndcg = 1.0 / math.log2(rank + 1)
        ap = 1.0 / rank
    else:
        ndcg = 0.0
        ap = 0.0
    return {"precision": precision, "recall": recall, "hit": hit, "ndcg": ndcg, "ap": ap}


def entropy(labels):
    counts = {}
    for l in labels:
        counts[l] = counts.get(l, 0) + 1
    n = len(labels) or 1
    h = 0.0
    for c in counts.values():
        p = c / n
        h -= p * math.log2(p)
    return round(h, 3)


def mmr_rerank(scored_items, explore=0.5):
    """Python port of backend/services/diversityService.js rerankWithDiversity, for the +MMR row."""
    remaining = scored_items[:]
    out = []
    topic_count, domain_count = {}, {}
    while remaining:
        best_idx, best_score = 0, -1e18
        for i, it in enumerate(remaining):
            t = it["topic"] or "unknown"
            d = it["domain"] or "unknown"
            penalty = (topic_count.get(t, 0) * 0.12 + domain_count.get(d, 0) * 0.1) * explore
            adj = it["_score"] - penalty
            if adj > best_score:
                best_score, best_idx = adj, i
        picked = remaining.pop(best_idx)
        out.append(picked)
        topic_count[picked["topic"] or "unknown"] = topic_count.get(picked["topic"] or "unknown", 0) + 1
        domain_count[picked["domain"] or "unknown"] = domain_count.get(picked["domain"] or "unknown", 0) + 1
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    t_start = time.time()
    conn = get_conn()
    print("[evaluate] loading interactions + content...")
    interactions = load_all_interactions(conn)
    content_by_id = load_content(conn)
    all_item_ids = list(content_by_id.keys())
    print(f"[evaluate] {len(interactions)} interactions, {len(content_by_id)} content items")

    # attach topic/domain onto each interaction row for profile building
    for r in interactions:
        item = content_by_id.get(r["content_id"])
        r["topic"] = item["topic"] if item else None
        r["domain"] = item["domain"] if item else None

    train_rows, test_pairs = temporal_split(interactions)
    print(f"[evaluate] split: {len(train_rows)} train rows, {len(test_pairs)} eval users (>= 3 positives)")

    if len(test_pairs) < 10:
        print("[evaluate] too few eval users to produce meaningful metrics, aborting")
        return

    # ---- rebuild profiles from TRAIN only ----
    from common import build_user_profiles, build_user_embedding
    profiles = build_user_profiles(train_rows)
    user_embeddings = build_user_embedding(train_rows, content_by_id)

    # ---- retrain CF from TRAIN only (no leakage) ----
    print("[evaluate] retraining CF on TRAIN split only...")
    positive_train = [(r["user_id"], r["content_id"], r["weight"]) for r in train_rows if r["weight"] > 0]
    cf_user_ids = sorted({r[0] for r in positive_train})
    cf_item_ids = sorted({r[1] for r in positive_train})
    X, Y = als_implicit(cf_user_ids, cf_item_ids, positive_train, n_iter=10)
    cf_user_factors = {uid: X[i] for i, uid in enumerate(cf_user_ids)}
    cf_item_factors = {iid: Y[i] for i, iid in enumerate(cf_item_ids)}

    # ---- build a small pointwise training set for the learned ranker ----
    print("[evaluate] training LightGBM LambdaMART ranker on TRAIN split...")
    import lightgbm as lgb

    train_by_user = {}
    for r in train_rows:
        train_by_user.setdefault(r["user_id"], []).append(r)

    ranker_X, ranker_y, ranker_group = [], [], []
    now_ts = time.time()
    for uid, rows in train_by_user.items():
        pos_ids = {r["content_id"] for r in rows if r["event_type"] in ("open", "like")}
        neg_pool = [i for i in all_item_ids if i not in pos_ids]
        if not pos_ids or not neg_pool:
            continue
        ctx = {
            "profile": profiles.get(uid),
            "user_embedding": user_embeddings.get(uid),
            "user_id": uid,
            "cf_user_factors": cf_user_factors,
            "cf_item_factors": cf_item_factors,
            "now_ts": now_ts,
        }
        sampled_negs = random.sample(neg_pool, min(len(neg_pool), len(pos_ids) * 4))
        group_size = 0
        for pid in pos_ids:
            item = content_by_id.get(pid)
            if not item:
                continue
            ranker_X.append(features_for_ranker(item, ctx))
            ranker_y.append(2)  # like/open = relevance grade 2
            group_size += 1
        for nid in sampled_negs:
            item = content_by_id.get(nid)
            if not item:
                continue
            ranker_X.append(features_for_ranker(item, ctx))
            ranker_y.append(0)
            group_size += 1
        if group_size > 0:
            ranker_group.append(group_size)

    ranker = lgb.LGBMRanker(n_estimators=80, num_leaves=15, learning_rate=0.08, min_child_samples=5, verbosity=-1)
    ranker.fit(np.array(ranker_X), np.array(ranker_y), group=ranker_group)
    print(f"[evaluate] ranker trained on {len(ranker_X)} (user,item) rows across {len(ranker_group)} users")

    def score_learned(item, ctx):
        feats = np.array([features_for_ranker(item, ctx)])
        return float(ranker.predict(feats)[0])

    strategies = {
        "popularity_baseline": score_popularity,
        "content_only": score_content,
        "cf_only": score_cf,
        "hybrid": score_hybrid,
        "hybrid_plus_ranker": score_learned,
    }

    # ---- evaluation loop ----
    print(f"[evaluate] evaluating {len(test_pairs)} users x {N_NEGATIVES + 1} candidates each...")
    results = {name: {k: [] for k in K_VALUES} for name in strategies}
    results["hybrid_plus_ranker_mmr"] = {k: [] for k in K_VALUES}

    diversity_lists = {name: [] for name in list(strategies.keys()) + ["hybrid_plus_ranker_mmr"]}

    for user_id, held_out_id in test_pairs:
        held_out_item = content_by_id.get(held_out_id)
        if not held_out_item:
            continue

        interacted_ids = {r["content_id"] for r in interactions if r["user_id"] == user_id}
        neg_pool = [i for i in all_item_ids if i not in interacted_ids and i != held_out_id]
        negatives = random.sample(neg_pool, min(N_NEGATIVES, len(neg_pool)))
        candidate_ids = [held_out_id] + negatives
        candidates = [content_by_id[c] for c in candidate_ids if c in content_by_id]

        ctx = {
            "profile": profiles.get(user_id),
            "user_embedding": user_embeddings.get(user_id),
            "user_id": user_id,
            "cf_user_factors": cf_user_factors,
            "cf_item_factors": cf_item_factors,
            "now_ts": now_ts,
        }

        for name, score_fn in strategies.items():
            scored = sorted(candidates, key=lambda it: score_fn(it, ctx), reverse=True)
            ranked_ids = [it["id"] for it in scored]
            for k in K_VALUES:
                results[name][k].append(metrics_at_k(ranked_ids, held_out_id, k))
            if len(diversity_lists[name]) < DIVERSITY_SAMPLE_USERS:
                diversity_lists[name].append(scored[:10])

        # MMR applied on top of the learned-ranker scores
        scored_for_mmr = sorted(candidates, key=lambda it: score_learned(it, ctx), reverse=True)
        for it in scored_for_mmr:
            it["_score"] = score_learned(it, ctx)
        mmr_ranked = mmr_rerank(scored_for_mmr, explore=0.5)
        ranked_ids = [it["id"] for it in mmr_ranked]
        for k in K_VALUES:
            results["hybrid_plus_ranker_mmr"][k].append(metrics_at_k(ranked_ids, held_out_id, k))
        if len(diversity_lists["hybrid_plus_ranker_mmr"]) < DIVERSITY_SAMPLE_USERS:
            diversity_lists["hybrid_plus_ranker_mmr"].append(mmr_ranked[:10])

    # ---- aggregate ----
    def avg(vals):
        return round(sum(vals) / len(vals), 4) if vals else 0.0

    summary = {}
    for name in results:
        summary[name] = {}
        for k in K_VALUES:
            rows = results[name][k]
            summary[name][f"precision@{k}"] = avg([r["precision"] for r in rows])
            summary[name][f"recall@{k}"] = avg([r["recall"] for r in rows])
            summary[name][f"hit_rate@{k}"] = avg([r["hit"] for r in rows])
            summary[name][f"ndcg@{k}"] = avg([r["ndcg"] for r in rows])
            summary[name][f"map@{k}"] = avg([r["ap"] for r in rows])

        lists = diversity_lists[name]
        all_topics = [it["topic"] for lst in lists for it in lst if it.get("topic")]
        unique_items_shown = {it["id"] for lst in lists for it in lst}
        summary[name]["topic_entropy"] = entropy(all_topics) if all_topics else 0.0
        summary[name]["catalog_coverage_in_top10"] = round(len(unique_items_shown) / len(all_item_ids), 4)

    out = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "protocol": {
            "splitType": "per-user temporal leave-last-positive-out",
            "minPositivesForEval": 3,
            "evalUsers": len(test_pairs),
            "candidatesPerUser": N_NEGATIVES + 1,
            "kValues": K_VALUES,
        },
        "results": summary,
    }

    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    out_path = os.path.join(os.path.dirname(__file__), "evaluation_results.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2)

    print(f"\n[evaluate] done in {time.time() - t_start:.1f}s. Wrote {out_path}\n")
    print_markdown_table(summary)


def print_markdown_table(summary):
    order = ["popularity_baseline", "content_only", "cf_only", "hybrid", "hybrid_plus_ranker", "hybrid_plus_ranker_mmr"]
    labels = {
        "popularity_baseline": "Popularity baseline",
        "content_only": "Content-based only",
        "cf_only": "Collaborative filtering only",
        "hybrid": "Hybrid (content+CF+popularity)",
        "hybrid_plus_ranker": "Hybrid + LightGBM LambdaMART ranker",
        "hybrid_plus_ranker_mmr": "Hybrid + ranker + MMR diversity",
    }
    print("| Model | Precision@10 | Recall@10 | nDCG@10 | MAP@10 | Topic entropy | Coverage@10 |")
    print("|---|---|---|---|---|---|---|")
    for name in order:
        s = summary[name]
        print(
            f"| {labels[name]} | {s['precision@10']} | {s['recall@10']} | {s['ndcg@10']} | "
            f"{s['map@10']} | {s['topic_entropy']} | {s['catalog_coverage_in_top10']} |"
        )


if __name__ == "__main__":
    main()
