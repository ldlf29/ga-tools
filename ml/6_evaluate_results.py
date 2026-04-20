"""
Script 9 - Evaluation & Backtesting
====================================
Evaluates the current CatBoost models by comparing predictions against 
actual results from the historical data collected.
"""

import pandas as pd
import numpy as np
import catboost as cb
import json
import os
import re
import sys
from pathlib import Path
from math import floor

# Add parent dir to path to import from ml/
sys.path.append(str(Path(__file__).parent))

import importlib
_preprocess = importlib.import_module("2_preprocess")
load_moki_stats_cache = _preprocess.load_moki_stats_cache
get_effective_class = _preprocess.get_effective_class
calculate_role_adjusted_points = _preprocess.calculate_role_adjusted_points

# ─── Config ──────────────────────────────────────────────────────────────────

DATA_DIR    = Path(__file__).parent / "data"
MODELS_DIR  = Path(__file__).parent / "models"
INPUT_PATH  = DATA_DIR / "raw_matches.csv"
METADATA_PATH = Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json"

CLASSES = [
    "Anchor", "Bruiser", "Center", "Defender", "Flanker",
    "Forward", "Grinder", "Sprinter", "Striker", "Support"
]

GENERIC_NAME_RE = re.compile(r"^Moki\s*#\d+$", re.IGNORECASE)

# ─── Load Models ─────────────────────────────────────────────────────────────

def load_models():
    print("[INFO] Loading CatBoost models...")
    models = {}
    
    config = [
        ("winrate", cb.CatBoostClassifier, "model_winrate.cbm"),
        ("score", cb.CatBoostRegressor, "model_score.cbm"),
        ("cond", cb.CatBoostClassifier, "model_wincondition.cbm"),
        ("deaths", cb.CatBoostRegressor, "model_deaths.cbm"),
        ("kills", cb.CatBoostRegressor, "model_kills.cbm"),
        ("deposits", cb.CatBoostRegressor, "model_deposits.cbm"),
        ("wartcloser", cb.CatBoostClassifier, "model_wartcloser.cbm"),
        ("wartdistance", cb.CatBoostRegressor, "model_wart_distance.cbm"),
    ]
    
    for key, cls, filename in config:
        path = MODELS_DIR / filename
        if path.exists():
            m = cls()
            m.load_model(str(path))
            models[key] = m
        else:
            print(f"[WARN] Model {filename} not found.")
            models[key] = None
            
    return models

# ─── Helpers ──────────────────────────────────────────────────────────────────

def identify_roles_and_features(row):
    """Reconstructs features exactly as the models expect."""
    moki_tid = int(row["moki_token_id"])
    players = []
    for i in range(1, 7):
        tid_col = f"p{i}_token_id"
        if tid_col not in row or pd.isna(row[tid_col]): continue
        tid = int(row[tid_col])
        raw_class = str(row.get(f"p{i}_class", ""))
        eff_class = get_effective_class(tid, raw_class)
        players.append({
            "token_id": tid,
            "name": str(row.get(f"p{i}_name", "")),
            "team": str(row.get(f"p{i}_team", "")),
            "class": eff_class
        })
    
    this_player = next((p for p in players if p["token_id"] == moki_tid), None)
    if not this_player: return None
    
    my_team = this_player["team"]
    allies = [p for p in players if p["team"] == my_team and p["token_id"] != moki_tid]
    enemies = [p for p in players if p["team"] != my_team]
    
    enemy_champ = next((e for e in enemies if not GENERIC_NAME_RE.match(e["name"])), enemies[0] if enemies else None)
    enemy_class = enemy_champ["class"] if enemy_champ else "Unknown"
    enemy_tid = int(enemy_champ["token_id"]) if enemy_champ else -1
    
    # Feature Engineering (must match 2_preprocess.py and 3_prepare_features.py)
    champ_cls  = this_player["class"]
    ally_classes = sorted([a["class"] for a in allies])
    team_comp  = "_".join([champ_cls.upper()] + [c.upper() for c in ally_classes])

    enemy_ally_classes = sorted([e["class"] for e in enemies if e["token_id"] != enemy_tid])
    enemy_comp = "_".join([enemy_class.upper()] + [c.upper() for c in enemy_ally_classes])

    feat = {
        "champ_class":       champ_cls,
        "enemy_champ_class": enemy_class,
        "team_comp":         team_comp,
        "enemy_comp":        enemy_comp,
    }

    for cls in CLASSES:
        feat[f"ally_{cls}_count"] = ally_classes.count(cls)
        feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)

    return feat

# ─── Main Logic ───────────────────────────────────────────────────────────────

def main():
    models = load_models()
    if not models["winrate"] or not models["score"]:
        print("[ERROR] Required models not found. Aborting evaluation.")
        return

    print(f"[INFO] Reading {INPUT_PATH}...")
    load_moki_stats_cache()
    df = pd.read_csv(INPUT_PATH)
    
    # Calculate actual points using role-adjusted formula (matches training target)
    # The model was trained on adjusted points, so we evaluate on the same scale.
    # We also keep raw points for reference.
    df["actual_points_raw"] = df.apply(lambda r: _preprocess.calculate_points(
        r["res_won"], r["res_eliminations"], r["res_deposits"], r["res_wart_distance"]
    ), axis=1)
    df["actual_points"] = df.apply(calculate_role_adjusted_points, axis=1)
    
    results = []
    moki_ids = df["moki_token_id"].unique()
    
    print(f"[INFO] Evaluating {len(moki_ids)} Mokis (Last 10 matches each)...")
    
    for moki_id in moki_ids:
        moki_df = df[df["moki_token_id"] == moki_id].sort_values("match_date", ascending=False).head(10)
        if len(moki_df) < 1: continue
        
        features_list = []
        actual_vals = {"score": [], "score_raw": [], "win": [], "deaths": [], "deposits": []}
        champ_class = ""
        
        for _, row in moki_df.iterrows():
            feat = identify_roles_and_features(row)
            if not feat: continue
            
            features_list.append(feat)
            actual_vals["score"].append(row["actual_points"])
            actual_vals["score_raw"].append(row["actual_points_raw"])
            actual_vals["win"].append(1 if row["res_won"] else 0)
            actual_vals["deaths"].append(row["res_deaths"])
            actual_vals["deposits"].append(row["res_deposits"])
            champ_class = feat["champ_class"]
            
        if not features_list: continue
        
        df_feat = pd.DataFrame(features_list)
        
        # FASE 1: Auxiliares (Cascade Features)
        df_feat["pred_deaths"]     = models["deaths"].predict(df_feat).clip(min=0) if models["deaths"] else 0
        df_feat["pred_kills"]      = models["kills"].predict(df_feat).clip(min=0) if models["kills"] else 0
        df_feat["pred_deposits"]   = models["deposits"].predict(df_feat).clip(min=0) if models["deposits"] else 0
        df_feat["pred_wartcloser"] = models["wartcloser"].predict_proba(df_feat)[:, 1] if models["wartcloser"] else 0.5
        df_feat["pred_wartdistance"] = models["wartdistance"].predict(df_feat).clip(min=0) if models["wartdistance"] else 0
        
        # FASE 2: Main Predictions
        pred_win_probs = models["winrate"].predict_proba(df_feat)[:, 1]
        pred_scores    = models["score"].predict(df_feat).clip(min=0)
        
        results.append({
            "moki_id": moki_id,
            "class": champ_class,
            "matches": len(df_feat),
            "pred_score": sum(pred_scores),
            "actual_score": sum(actual_vals["score"]),           # role-adjusted (= training target)
            "actual_score_raw": sum(actual_vals["score_raw"]),   # raw points (for reference)
            "score_abs_error": abs(sum(pred_scores) - sum(actual_vals["score"])),
            "pred_winrate": (sum(pred_win_probs) / len(df_feat)) * 100,
            "actual_winrate": (sum(actual_vals["win"]) / len(df_feat)) * 100,
            "winrate_abs_error": abs(((sum(pred_win_probs) - sum(actual_vals["win"])) / len(df_feat)) * 100),
            "actual_deaths": sum(actual_vals["deaths"]),
            "actual_deposits": sum(actual_vals["deposits"])
        })
        
    eval_df = pd.DataFrame(results)
    
    # Global Metrics
    mae_score = eval_df["score_abs_error"].mean()
    mae_winrate = eval_df["winrate_abs_error"].mean()
    
    print("\n" + "="*50)
    print("GLOBAL PERFORMANCE REPORT (10-MATCH BLOCKS)")
    print("="*50)
    print(f"Mean Absolute Error (Score, adj):  {mae_score:.2f} pts  ← model comparison scale")
    print(f"Mean Absolute Error (WinRate):     {mae_winrate:.2f}%")
    print(f"Total Mokis Evaluated:             {len(eval_df)}")
    
    # Report by Class
    class_report = eval_df.groupby("class").agg({
        "score_abs_error": "mean",
        "winrate_abs_error": "mean",
        "moki_id": "count"
    }).rename(columns={"moki_id": "count"}).sort_values("score_abs_error")
    
    print("\n" + "="*50)
    print("PERFORMANCE BY CLASS (Sorted by Accuracy)")
    print("="*50)
    print(class_report.to_string())
    
    eval_df.to_csv(DATA_DIR / "evaluation_results.csv", index=False)
    print(f"\n[OK] Detailed evaluation saved to {DATA_DIR / 'evaluation_results.csv'}")

if __name__ == "__main__":
    main()
