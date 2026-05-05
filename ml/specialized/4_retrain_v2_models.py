"""
Script 4 — Retrain V2 Models using Best Params
==============================================
Lee best_params.json de la optimizacion previa (11_optuna_optimize.py)
y reentrena los modelos V2 (Striker y Defender) con la data actualizada.
"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from catboost import CatBoostClassifier, CatBoostRegressor

from config import (
    DATA_DIR, V2_MODELS_DIR, CLASSES, TRAIN_CUTOFF, VAL_CUTOFF,
    ensure_dirs, print_separator
)

STRIKER_INPUT  = DATA_DIR / "striker_matches_v2.csv"
DEFENDER_INPUT = DATA_DIR / "defender_matches_v2.csv"

# Fallbacks if _v2 files not generated yet, try striker_matches.csv
if not STRIKER_INPUT.exists():
    STRIKER_INPUT = DATA_DIR / "striker_matches.csv"
if not DEFENDER_INPUT.exists():
    DEFENDER_INPUT = DATA_DIR / "defender_matches.csv"

BASE_CAT_FEATURES = ["champ_class", "enemy_champ_class", "team_comp", "enemy_comp", "matchup_key"]

COMPANION_HIST_FEATURES = [
    "hist_matchup_wr", "hist_pair_wr",
    "hist_wr_with_ally1", "hist_wr_with_ally2",
    "hist_kills_ally1", "hist_kills_ally2",
    "hist_deposits_ally1", "hist_deposits_ally2",
    "hist_wart_ally1", "hist_wart_ally2",
    "hist_role_ally1", "hist_role_ally2",
    "ally1_class", "ally2_class",
]

COMPANION_CAT_NAMES = {"hist_role_ally1", "hist_role_ally2", "ally1_class", "ally2_class"}

def get_count_features():
    cols = []
    for cls in CLASSES:
        cols.append(f"ally_{cls}_count")
        cols.append(f"enemy_ally_{cls}_count")
    return cols

def get_base_features():
    return list(BASE_CAT_FEATURES) + COMPANION_HIST_FEATURES + get_count_features()

def get_cat_indices(feature_cols):
    cat_names = set(BASE_CAT_FEATURES) | COMPANION_CAT_NAMES
    return [i for i, c in enumerate(feature_cols) if c in cat_names]

def time_split(df):
    df = df.copy()
    # If no match_date, fake it or fallback
    if "match_date" not in df.columns:
        print("[WARN] No match_date found, skipping time split.")
        train = df.iloc[:int(len(df)*0.8)]
        val   = df.iloc[int(len(df)*0.8):]
        return train, val, val
        
    df["_date"] = pd.to_datetime(df["match_date"]).dt.strftime("%Y-%m-%d")
    train = df[df["_date"] < TRAIN_CUTOFF].drop(columns=["_date"])
    val   = df[(df["_date"] >= TRAIN_CUTOFF) & (df["_date"] < VAL_CUTOFF)].drop(columns=["_date"])
    test  = df[df["_date"] >= VAL_CUTOFF].drop(columns=["_date"])
    
    # Si la data no tiene split, usaremos holdout 80/20
    if len(val) == 0:
        print("[WARN] Val split empty, using 80/20 holdout.")
        train = df.sample(frac=0.8, random_state=42).drop(columns=["_date"])
        val   = df.drop(train.index).drop(columns=["_date"])
        test  = val
        
    return train, val, test

def add_predictions(X, col, values):
    out = X.copy()
    out[col] = values
    return out

def retrain_class(df, class_name):
    print_separator(f"RETRAINING V2: {class_name.upper()}")
    model_dir = V2_MODELS_DIR / class_name.lower()
    
    params_path = model_dir / "best_params.json"
    if not params_path.exists():
        print(f"[ERROR] No best_params.json found at {params_path}. Cannot retrain.")
        return
        
    with open(params_path, "r") as f:
        best_params_all = json.load(f)
        
    train, val, test = time_split(df)
    base_cols = [c for c in get_base_features() if c in df.columns]
    cat_idx0 = get_cat_indices(base_cols)
    
    X0_tr = train[base_cols].fillna("").astype(str)
    X0_va = val[base_cols].fillna("").astype(str)
    X0_te = test[base_cols].fillna("").astype(str)
    
    # ── Phase 0: Duration ──
    print(f"\n[TRAIN] Phase 0 (Duration)...")
    y_dur_tr = train["match_duration"].astype(float)
    y_dur_va = val["match_duration"].astype(float)
    y_dur_te = test["match_duration"].astype(float)
    
    m_dur = CatBoostRegressor(**best_params_all["duration"])
    m_dur.fit(X0_tr, y_dur_tr, cat_features=cat_idx0, eval_set=(X0_va, y_dur_va), use_best_model=True, verbose=False)
    m_dur.save_model(str(model_dir / "optimized_duration.cbm"))
    
    mae_dur = np.abs(np.maximum(0, m_dur.predict(X0_te)) - y_dur_te).mean()
    print(f"     MAE (test): {mae_dur:.2f}")

    p_dur_tr = np.maximum(0, m_dur.predict(X0_tr))
    p_dur_va = np.maximum(0, m_dur.predict(X0_va))
    p_dur_te = np.maximum(0, m_dur.predict(X0_te))
    
    p1_cols = base_cols + ["pred_duration"]
    cat_idx1 = get_cat_indices(p1_cols)
    X1_tr = add_predictions(X0_tr, "pred_duration", p_dur_tr)
    X1_va = add_predictions(X0_va, "pred_duration", p_dur_va)
    X1_te = add_predictions(X0_te, "pred_duration", p_dur_te)

    if class_name == "Striker":
        # ── Phase 1: Deposits ──
        print(f"\n[TRAIN] Phase 1 (Deposits)...")
        y_dep_tr = train["res_deposits"].astype(float)
        y_dep_va = val["res_deposits"].astype(float)
        y_dep_te = test["res_deposits"].astype(float)
        
        m_dep = CatBoostRegressor(**best_params_all["deposits"])
        m_dep.fit(X1_tr, y_dep_tr, cat_features=cat_idx1, eval_set=(X1_va, y_dep_va), use_best_model=True, verbose=False)
        m_dep.save_model(str(model_dir / "optimized_deposits.cbm"))
        
        mae_dep = np.abs(np.maximum(0, m_dep.predict(X1_te)) - y_dep_te).mean()
        print(f"     MAE (test): {mae_dep:.2f}")

        p_dep_tr = np.maximum(0, m_dep.predict(X1_tr))
        p_dep_va = np.maximum(0, m_dep.predict(X1_va))
        p_dep_te = np.maximum(0, m_dep.predict(X1_te))
        
        # ── Phase 2: Win ──
        print(f"\n[TRAIN] Phase 2 (Win Rate)...")
        p2_cols = p1_cols + ["pred_deposits"]
        cat_idx2 = get_cat_indices(p2_cols)
        X2_tr = add_predictions(X1_tr, "pred_deposits", p_dep_tr)
        X2_va = add_predictions(X1_va, "pred_deposits", p_dep_va)
        X2_te = add_predictions(X1_te, "pred_deposits", p_dep_te)
        
        y_win_tr = train["is_win"].astype(int)
        y_win_va = val["is_win"].astype(int)
        y_win_te = test["is_win"].astype(int)
        
        m_win = CatBoostClassifier(**best_params_all["winrate"])
        m_win.fit(X2_tr, y_win_tr, cat_features=cat_idx2, eval_set=(X2_va, y_win_va), use_best_model=True, verbose=False)
        m_win.save_model(str(model_dir / "optimized_winrate.cbm"))

        acc_win = (m_win.predict(X2_te) == y_win_te).mean()
        print(f"     Acc (test): {acc_win*100:.2f}%")
        
    elif class_name == "Defender":
        # ── Phase 1a: Kills ──
        print(f"\n[TRAIN] Phase 1a (Kills)...")
        y_ki_tr = train["res_eliminations"].astype(float)
        y_ki_va = val["res_eliminations"].astype(float)
        y_ki_te = test["res_eliminations"].astype(float)
        
        m_ki = CatBoostRegressor(**best_params_all["kills"])
        m_ki.fit(X1_tr, y_ki_tr, cat_features=cat_idx1, eval_set=(X1_va, y_ki_va), use_best_model=True, verbose=False)
        m_ki.save_model(str(model_dir / "optimized_kills.cbm"))

        mae_ki = np.abs(np.maximum(0, m_ki.predict(X1_te)) - y_ki_te).mean()
        print(f"     MAE (test): {mae_ki:.2f}")
        
        p_ki_tr = np.maximum(0, m_ki.predict(X1_tr))
        p_ki_va = np.maximum(0, m_ki.predict(X1_va))
        p_ki_te = np.maximum(0, m_ki.predict(X1_te))
        
        # ── Phase 1b: Wart ──
        print(f"\n[TRAIN] Phase 1b (Wart)...")
        y_wa_tr = train["res_wart_distance"].astype(float)
        y_wa_va = val["res_wart_distance"].astype(float)
        y_wa_te = test["res_wart_distance"].astype(float)
        
        m_wa = CatBoostRegressor(**best_params_all["wart"])
        m_wa.fit(X1_tr, y_wa_tr, cat_features=cat_idx1, eval_set=(X1_va, y_wa_va), use_best_model=True, verbose=False)
        m_wa.save_model(str(model_dir / "optimized_wart.cbm"))

        mae_wa = np.abs(np.maximum(0, m_wa.predict(X1_te)) - y_wa_te).mean()
        print(f"     MAE (test): {mae_wa:.2f}")
        
        p_wa_tr = np.maximum(0, m_wa.predict(X1_tr))
        p_wa_va = np.maximum(0, m_wa.predict(X1_va))
        p_wa_te = np.maximum(0, m_wa.predict(X1_te))
        
        # ── Phase 2: Win ──
        print(f"\n[TRAIN] Phase 2 (Win Rate)...")
        p2_cols = p1_cols + ["pred_kills", "pred_wart"]
        cat_idx2 = get_cat_indices(p2_cols)
        X2_tr = add_predictions(add_predictions(X1_tr, "pred_kills", p_ki_tr), "pred_wart", p_wa_tr)
        X2_va = add_predictions(add_predictions(X1_va, "pred_kills", p_ki_va), "pred_wart", p_wa_va)
        X2_te = add_predictions(add_predictions(X1_te, "pred_kills", p_ki_te), "pred_wart", p_wa_te)
        
        y_win_tr = train["is_win"].astype(int)
        y_win_va = val["is_win"].astype(int)
        y_win_te = test["is_win"].astype(int)
        
        m_win = CatBoostClassifier(**best_params_all["winrate"])
        m_win.fit(X2_tr, y_win_tr, cat_features=cat_idx2, eval_set=(X2_va, y_win_va), use_best_model=True, verbose=False)
        m_win.save_model(str(model_dir / "optimized_winrate.cbm"))

        acc_win = (m_win.predict(X2_te) == y_win_te).mean()
        print(f"     Acc (test): {acc_win*100:.2f}%")
        
    print(f"\n[OK] Completed retrain for {class_name}")

def main():
    ensure_dirs()
    
    if not STRIKER_INPUT.exists():
        print(f"[ERROR] Missing Striker input data. Expected {STRIKER_INPUT}")
        return
    
    if not DEFENDER_INPUT.exists():
        print(f"[ERROR] Missing Defender input data. Expected {DEFENDER_INPUT}")
        return
        
    df_striker = pd.read_csv(STRIKER_INPUT, low_memory=False)
    df_defender = pd.read_csv(DEFENDER_INPUT, low_memory=False)
    
    retrain_class(df_striker, "Striker")
    retrain_class(df_defender, "Defender")
    
    print("\n[DONE] V2 Retrain using best parameters complete (Striker + Defender).")

if __name__ == "__main__":
    main()
