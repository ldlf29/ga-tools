"""
Script 9 - Evaluation & Backtesting
====================================
Evaluates the current CatBoost models by comparing predictions against 
actual results from the historical data collected (March 29th - April 2nd).
"""

import pandas as pd
import numpy as np
import catboost as cb
import json
import os
import re
from pathlib import Path
from math import floor

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

print("[INFO] Loading CatBoost models...")
model_winrate = cb.CatBoostClassifier()
model_winrate.load_model(str(MODELS_DIR / "model_winrate.cbm"))

model_score = cb.CatBoostRegressor()
model_score.load_model(str(MODELS_DIR / "model_score.cbm"))

model_cond = cb.CatBoostClassifier()
model_cond.load_model(str(MODELS_DIR / "model_wincondition.cbm"))

model_deaths = cb.CatBoostRegressor()
model_deaths.load_model(str(MODELS_DIR / "model_deaths.cbm"))

model_kills = cb.CatBoostRegressor()
model_kills.load_model(str(MODELS_DIR / "model_kills.cbm"))

model_deposits = cb.CatBoostRegressor()
model_deposits.load_model(str(MODELS_DIR / "model_deposits.cbm"))

model_wartcloser = cb.CatBoostClassifier()
model_wartcloser.load_model(str(MODELS_DIR / "model_wartcloser.cbm"))

# ─── Helpers ──────────────────────────────────────────────────────────────────

def calculate_points(is_win, elims, deposits, wart_dist):
    pts = 200 if is_win else 0   # Updated: 200 pts (was 300)
    pts += int(elims) * 80
    pts += int(deposits) * 50
    pts += floor(float(wart_dist) / 80) * 40  # Updated: 40 pts (was 45)
    return pts

def identify_roles_and_features(row):
    moki_tid = int(row["moki_token_id"])
    players = []
    for i in range(1, 7):
        if pd.isna(row.get(f"p{i}_token_id")): continue
        players.append({
            "token_id": int(row.get(f"p{i}_token_id")),
            "name": str(row.get(f"p{i}_name", "")),
            "team": str(row.get(f"p{i}_team", "")),
            "class": str(row.get(f"p{i}_class", ""))
        })
    
    this_player = next((p for p in players if p["token_id"] == moki_tid), None)
    if not this_player: return None
    
    my_team = this_player["team"]
    allies = [p for p in players if p["team"] == my_team and p["token_id"] != moki_tid]
    enemies = [p for p in players if p["team"] != my_team]
    
    enemy_champ = next((e for e in enemies if not GENERIC_NAME_RE.match(e["name"])), enemies[0] if enemies else None)
    enemy_class = enemy_champ["class"] if enemy_champ else "Unknown"
    enemy_tid = int(enemy_champ["token_id"]) if enemy_champ else 0
    enemy_allies = [e for e in enemies if e["token_id"] != (enemy_champ["token_id"] if enemy_champ else -1)]
    
    # Composiciones ordenadas (deben coincidir con _2_preprocess.py)
    champ_cls  = this_player["class"]
    ally_classes = sorted([a["class"] for a in allies])
    team_comp  = "_".join([champ_cls.upper()] + [c.upper() for c in ally_classes])

    enemy_allies = [e for e in enemies if e["token_id"] != (enemy_champ["token_id"] if enemy_champ else -1)]
    enemy_ally_classes = sorted([e["class"] for e in enemy_allies])
    enemy_comp = "_".join([enemy_class.upper()] + [c.upper() for c in enemy_ally_classes])

    feat = {
        "champ_class":       champ_cls,
        "enemy_champ_class": enemy_class,
        "team_comp":         team_comp,
        "enemy_comp":        enemy_comp,
    }

    for cls in CLASSES:
        feat[f"ally_{cls}_count"]       = ally_classes.count(cls)
        feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)

    return feat

# ─── Main Logic ───────────────────────────────────────────────────────────────

def main():
    print(f"[INFO] Reading {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH)
    
    # Calculate actual points
    df["actual_points"] = df.apply(lambda r: calculate_points(
        r["res_won"], r["res_eliminations"], r["res_deposits"], r["res_wart_distance"]
    ), axis=1)
    
    results = []
    moki_ids = df["moki_token_id"].unique()
    
    print(f"[INFO] Evaluating {len(moki_ids)} Mokis...")
    
    for moki_id in moki_ids:
        # Get last 10 matches for this Moki
        moki_df = df[df["moki_token_id"] == moki_id].sort_values("match_date", ascending=False).head(10)
        
        if len(moki_df) < 1: continue
        
        features_list = []
        actual_scores = []
        actual_wins = []
        actual_deaths = []
        actual_deposits = []
        
        champ_class = ""
        
        for _, row in moki_df.iterrows():
            feat = identify_roles_and_features(row)
            if not feat: continue
            
            features_list.append(feat)
            actual_scores.append(row["actual_points"])
            actual_wins.append(1 if row["res_won"] else 0)
            actual_deaths.append(row["res_deaths"])
            actual_deposits.append(row["res_deposits"])
            champ_class = feat["champ_class"]
            
        if not features_list: continue
        
        df_feat = pd.DataFrame(features_list)
        
        # FASE 1: Auxiliares (necesario para el Stacking de la Fase 2)
        df_feat["pred_deaths"]     = model_deaths.predict(df_feat).clip(min=0)
        df_feat["pred_kills"]      = model_kills.predict(df_feat).clip(min=0)
        df_feat["pred_deposits"]   = model_deposits.predict(df_feat).clip(min=0)
        df_feat["pred_wartcloser"] = model_wartcloser.predict_proba(df_feat)[:, 1]

        # FASE 2: Predicciones principales (con cascade features)
        pred_win_probs = model_winrate.predict_proba(df_feat)[:, 1]
        pred_scores = model_score.predict(df_feat).clip(min=0)
        pred_deaths_main = model_deaths.predict(df_feat).clip(min=0)
        pred_deposits_main = model_deposits.predict(df_feat).clip(min=0)        
        # Aggregates (10 matches)
        total_pred_score = sum(pred_scores)
        total_actual_score = sum(actual_scores)
        
        avg_pred_winrate = (sum(pred_win_probs) / len(pred_win_probs)) * 100
        actual_winrate = (sum(actual_wins) / len(actual_wins)) * 100
        
        results.append({
            "moki_id": moki_id,
            "class": champ_class,
            "matches": len(moki_df),
            "pred_score": total_pred_score,
            "actual_score": total_actual_score,
            "score_diff": total_pred_score - total_actual_score,
            "score_abs_error": abs(total_pred_score - total_actual_score),
            "pred_winrate": avg_pred_winrate,
            "actual_winrate": actual_winrate,
            "winrate_diff": avg_pred_winrate - actual_winrate,
            "winrate_abs_error": abs(avg_pred_winrate - actual_winrate),
            "pred_deaths": sum(pred_deaths_main),
            "actual_deaths": sum(actual_deaths),
            "pred_deposits": sum(pred_deposits_main),
            "actual_deposits": sum(actual_deposits)
        })
        
    eval_df = pd.DataFrame(results)
    
    # Global Metrics
    mae_score = eval_df["score_abs_error"].mean()
    mae_winrate = eval_df["winrate_abs_error"].mean()
    
    print("\n" + "="*50)
    print("GLOBAL PERFORMANCE REPORT (10-MATCH BLOCKS)")
    print("="*50)
    print(f"Mean Absolute Error (Score):   {mae_score:.2f} pts")
    print(f"Mean Absolute Error (WinRate): {mae_winrate:.2f}%")
    print(f"Total Mokis Evaluated:         {len(eval_df)}")
    
    # Report by Class
    class_report = eval_df.groupby("class").agg({
        "score_abs_error": "mean",
        "winrate_abs_error": "mean",
        "score_diff": "mean",
        "moki_id": "count"
    }).rename(columns={"moki_id": "count"}).sort_values("score_abs_error")
    
    print("\n" + "="*50)
    print("PERFORMANCE BY CLASS (Sorted by Accuracy)")
    print("="*50)
    print(class_report.to_string())
    
    # Save results
    eval_df.to_csv(DATA_DIR / "evaluation_results.csv", index=False)
    print(f"\n[OK] Detailed evaluation saved to {DATA_DIR / 'evaluation_results.csv'}")

if __name__ == "__main__":
    main()
