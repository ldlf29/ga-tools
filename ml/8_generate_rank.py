"""
Script 8 - Rank 180 Mokis (Cascade Version)
=========================
Descarga partidas, identifica campeones y utiliza arquitectura de cascada
(auxiliares + stacking) para generar el ranking final.
"""

import pandas as pd
import requests
import json
import os
import catboost as cb
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists(): load_dotenv(ENV_PATH)
else: load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

MODELS_DIR = Path(__file__).parent / "models"

print("[INFO] Cargando modelos de Cascada para Ranking...")
# Auxiliares
model_deaths = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deaths.cbm"))
model_deposits = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deposits.cbm"))
model_wartcloser = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wartcloser.cbm"))

# Principales
model_winrate = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_winrate.cbm"))
model_score = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_score.cbm"))
model_cond = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wincondition.cbm"))

with open(Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json", "r", encoding="utf-8") as f:
    METADATA = json.load(f)

CLASSES = ["Anchor", "Bruiser", "Center", "Defender", "Flanker", "Forward", "Grinder", "Sprinter", "Striker", "Support"]

def get_moki_stats_overrides():
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=name,class"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        res = requests.get(url, headers=headers).json()
        return {str(row['name']).strip().lower(): row['class'] for row in res if row.get('name')}
    except: return {}

def main():
    url = f"{SUPABASE_URL}/rest/v1/upcoming_matches_ga?select=*"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200: return
    data = response.json()
    if not data: return

    class_overrides = get_moki_stats_overrides()
    moki_counts = {}
    moki_details = {}
    
    for row in data:
        for team_name in ["team_red", "team_blue"]:
            team = row.get(team_name, [])
            if team:
                champ = team[0]
                mid = champ.get("mokiTokenId")
                name_key = str(champ.get("name", "")).strip().lower()
                if name_key in class_overrides: champ["class"] = class_overrides[name_key]
                if mid:
                    moki_counts[mid] = moki_counts.get(mid, 0) + 1
                    moki_details[mid] = champ

    top_180 = [mid for mid, count in sorted(moki_counts.items(), key=lambda x: x[1], reverse=True)[:180]]
    results = []

    for moki_id in top_180:
        matches = []
        for row in data:
            if moki_id in [m.get("mokiTokenId") for m in row.get("team_red", []) + row.get("team_blue", [])]:
                matches.append(row)

        features_list = []
        champ_name = moki_details[moki_id].get("name")
        
        for match in matches:
            team_red, team_blue = match.get("team_red", []), match.get("team_blue", [])
            red_ids = [m.get("mokiTokenId") for m in team_red]
            my_team = team_red if moki_id in red_ids else team_blue
            enemy_team = team_blue if moki_id in red_ids else team_red
            
            for m in my_team + enemy_team:
                nk = str(m.get("name", "")).strip().lower()
                if nk in class_overrides: m["class"] = class_overrides[nk]

            my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
            if not my_moki: continue
            
            allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]
            enemy_champ = next((e for e in enemy_team if not e.get("name", "").lower().startswith("moki #")), enemy_team[0] if enemy_team else None)
            enemy_tid = enemy_champ.get("mokiTokenId") if enemy_champ else 0
            enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != enemy_tid]
            
            feat = {
                "moki_token_id": str(moki_id),
                "enemy_champ_token_id": str(enemy_tid),
                "moki_vs_enemy": f"{moki_id}_vs_{enemy_tid}",
                "champ_class": my_moki.get("class"),
                "enemy_champ_class": enemy_champ.get("class") if enemy_champ else "Unknown"
            }
            ally_classes = [a.get("class") for a in allies]
            enemy_ally_classes = [e.get("class") for e in enemy_allies]
            for cls in CLASSES:
                feat[f"ally_{cls}_count"] = ally_classes.count(cls)
                feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)
            features_list.append(feat)

        if not features_list: continue
        df_feat = pd.DataFrame(features_list)
        
        # --- FASE 1: AUX ---
        df_feat["pred_deaths"] = model_deaths.predict(df_feat)
        df_feat["pred_deposits"] = model_deposits.predict(df_feat)
        df_feat["pred_wartcloser"] = model_wartcloser.predict_proba(df_feat)[:, 1]
        
        # --- FASE 2: MAIN ---
        win_probs = model_winrate.predict_proba(df_feat)[:, 1]
        scores = model_score.predict(df_feat)
        cond_probs = model_cond.predict_proba(df_feat).mean(axis=0) * 100
        
        avg_wr = win_probs.mean() * 100

        # Find traits and fur from metadata
        fur = ""
        traits = ""
        for key, val in METADATA.items():
            if str(val.get("name")).lower().strip() == str(champ_name).lower().strip():
                fur = val.get("fur", "")
                traits = ", ".join(val.get("traits", []))
                break

        results.append({
            "Moki ID": moki_id,
            "Name": champ_name,
            "Class": moki_details[moki_id].get("class"),
            "Score": round(scores.sum(), 1),
            "WinRate": round(avg_wr, 1),
            "Wart Closer": round(len(matches) * (df_feat["pred_wartcloser"].mean()), 1),
            "Losses": round(len(matches) * ((100 - avg_wr) / 100), 1),
            "Gacha Pts": round(df_feat["pred_deposits"].sum() * 50, 1),
            "Deaths": round(df_feat["pred_deaths"].sum(), 1),
            "Win By Combat": round(len(matches) * (avg_wr / 100) * (cond_probs[0] / 100), 2),
            "Fur": fur,
            "Traits": traits,
            "Win Cond: Eliminations (%)": round(cond_probs[0], 1),
            "Win Cond: Wart (%)": round(cond_probs[1], 1),
            "Win Cond: Gacha (%)": round(cond_probs[2], 1)
        })

    df_results = pd.DataFrame(results).sort_values("Score", ascending=False)
    out_file = Path(__file__).parent / "data" / "upcoming_180_ranking.csv"
    df_results.to_csv(out_file, index=False, encoding="utf-8-sig")
    print(f"\n[OK] Ranking en Cascada completado: {out_file}")
    print(df_results.head(5).to_string(index=False))

if __name__ == "__main__":
    main()
