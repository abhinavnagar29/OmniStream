"""
ml/train_cf.py -- Collaborative filtering via implicit-feedback matrix
factorization (ALS-style alternating least squares, implemented directly
with numpy so the only dependencies are numpy/scipy/psycopg2 -- no compiled
extension modules, which keeps this reproducible in restricted-network
environments like the one this was built in).

Reads: `interactions` table (user_id, content_id, weight) from Postgres.
Writes: ml/models/cf_factors.json -- {userFactors: {userId: [f0..fK]},
        itemFactors: {contentId: [f0..fK]}}

This trains on ALL interaction rows currently in the DB, which as of this
build are the SIMULATED rows from scripts/simulate/generateInteractions.js
(see that file's docstring). Swap in real interaction data with zero code
changes here once real users exist -- this script only cares about rows in
`interactions`, not their provenance.

Method: implicit ALS (Hu, Koren & Volinsky, 2008) -- confidence-weighted
factorization of the binary "did this user engage positively with this
item" signal, which is the standard formulation for implicit feedback
(as opposed to explicit 1-5 star ratings, which plain SVD assumes).
"""
import json
import os
import time
import numpy as np
import psycopg2
from dotenv import load_dotenv

load_dotenv()

N_FACTORS = 24
N_ITERATIONS = 15
REG = 0.1
ALPHA = 15.0  # confidence scaling: confidence = 1 + ALPHA * (positive interaction strength)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
OUT_PATH = os.path.join(MODELS_DIR, "cf_factors.json")


def load_interactions(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT user_id::text, content_id, SUM(weight)::float AS score
        FROM interactions
        WHERE weight > 0
        GROUP BY user_id, content_id
        HAVING SUM(weight) > 0
    """)
    rows = cur.fetchall()
    cur.close()
    return rows


def als_implicit(user_ids, item_ids, rows, n_factors=N_FACTORS, n_iter=N_ITERATIONS, reg=REG, alpha=ALPHA):
    n_users, n_items = len(user_ids), len(item_ids)
    u_index = {u: i for i, u in enumerate(user_ids)}
    i_index = {it: i for i, it in enumerate(item_ids)}

    # Sparse confidence matrix, stored as per-user and per-item interaction lists
    user_items = [[] for _ in range(n_users)]  # (item_idx, confidence)
    item_users = [[] for _ in range(n_items)]  # (user_idx, confidence)

    for uid, iid, score in rows:
        ui, ii = u_index[uid], i_index[iid]
        conf = 1.0 + alpha * min(score, 10.0)  # clip so a single hyperactive session can't dominate
        user_items[ui].append((ii, conf))
        item_users[ii].append((ui, conf))

    rng = np.random.default_rng(42)
    X = rng.normal(scale=0.05, size=(n_users, n_factors))  # user factors
    Y = rng.normal(scale=0.05, size=(n_items, n_factors))  # item factors

    reg_I = reg * np.eye(n_factors)

    for iteration in range(n_iter):
        t0 = time.time()
        # --- fix Y, solve for X ---
        YtY = Y.T @ Y
        for u in range(n_users):
            items = user_items[u]
            if not items:
                continue
            A = YtY + reg_I
            b = np.zeros(n_factors)
            for ii, conf in items:
                y_i = Y[ii]
                A = A + (conf - 1.0) * np.outer(y_i, y_i)
                b = b + conf * y_i
            X[u] = np.linalg.solve(A, b)

        # --- fix X, solve for Y ---
        XtX = X.T @ X
        for it in range(n_items):
            users = item_users[it]
            if not users:
                continue
            A = XtX + reg_I
            b = np.zeros(n_factors)
            for ui, conf in users:
                x_u = X[ui]
                A = A + (conf - 1.0) * np.outer(x_u, x_u)
                b = b + conf * x_u
            Y[it] = np.linalg.solve(A, b)

        print(f"[train_cf] iteration {iteration + 1}/{n_iter} done in {time.time() - t0:.2f}s")

    return X, Y


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    print("[train_cf] loading interactions...")
    rows = load_interactions(conn)
    print(f"[train_cf] {len(rows)} (user,item) positive-weight pairs")

    user_ids = sorted({r[0] for r in rows})
    item_ids = sorted({r[1] for r in rows})
    print(f"[train_cf] {len(user_ids)} users x {len(item_ids)} items")

    if len(user_ids) < 2 or len(item_ids) < 2:
        print("[train_cf] not enough data to train, aborting")
        return

    X, Y = als_implicit(user_ids, item_ids, rows)

    os.makedirs(MODELS_DIR, exist_ok=True)
    out = {
        "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "nFactors": N_FACTORS,
        "nUsers": len(user_ids),
        "nItems": len(item_ids),
        "note": "Trained on SIMULATED interaction data -- see scripts/simulate/generateInteractions.js",
        "userFactors": {uid: X[i].round(5).tolist() for i, uid in enumerate(user_ids)},
        "itemFactors": {iid: Y[i].round(5).tolist() for i, iid in enumerate(item_ids)},
    }
    with open(OUT_PATH, "w") as f:
        json.dump(out, f)
    print(f"[train_cf] wrote {OUT_PATH} ({os.path.getsize(OUT_PATH) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
