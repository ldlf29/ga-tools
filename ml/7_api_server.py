"""
Script 7 - API Server para Inferencias (FastAPI)
================================================
Levanta un servidor REST que recibe el ID de un Moki, consulta sus 10
futuras partidas en Supabase, utiliza una arquitectura de cascada para
predecir Score y Win Rate.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import catboost as cb
import pandas as pd
import uvicorn
import requests
import json
import os
from pathlib import Path
from dotenv import load_dotenv
ENV_PATH = Path(__file__).parent.parent / ".env.local"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# ─── Inicializar FastAPI y Modelos ──────────────────────────────────────────

app = FastAPI(title="Grand Arena ML Cascade Predictor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = Path(__file__).parent / "models"
DATA_DIR   = Path(__file__).parent / "data"

print("[INFO] Cargando modelos de Cascada...")
# Auxiliares
model_deaths = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deaths.cbm"))
model_deposits = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deposits.cbm"))
model_wartcloser = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wartcloser.cbm"))

# Principales (Stacking)
model_winrate = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_winrate.cbm"))
model_score = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_score.cbm"))
model_cond = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wincondition.cbm"))

with open(DATA_DIR / "scheme_ranking.json", "r", encoding="utf-8") as f:
    SCHEME_RANKING = json.load(f)

CLASSES = [
    "Anchor", "Bruiser", "Center", "Defender", "Flanker",
    "Forward", "Grinder", "Sprinter", "Striker", "Support"
]

def fetch_moki_matches(moki_id: int):
    url = f"{SUPABASE_URL}/rest/v1/upcoming_matches_ga?select=*"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200: return []
    data = response.json()
    moki_matches = []
    for row in data:
        red_ids = [m.get("mokiTokenId") for m in row.get("team_red", [])]
        blue_ids = [m.get("mokiTokenId") for m in row.get("team_blue", [])]
        if moki_id in red_ids or moki_id in blue_ids:
            moki_matches.append(row)
    return moki_matches

class PredictionRequest(BaseModel):
    moki_token_id: int
    scheme_name: str | None = None

@app.post("/predict")
def predict_moki_score(req: PredictionRequest):
    moki_id = req.moki_token_id
    scheme_name = req.scheme_name
    
    matches = fetch_moki_matches(moki_id)
    if not matches:
        raise HTTPException(status_code=404, detail=f"Moki #{moki_id} no tiene matches programados.")
    
    features_list = []
    champ_class = None
    
    for match in matches:
        team_red = match.get("team_red", [])
        team_blue = match.get("team_blue", [])
        red_ids = [m.get("mokiTokenId") for m in team_red]
        my_team = team_red if moki_id in red_ids else team_blue
        enemy_team = team_blue if moki_id in red_ids else team_red
        
        my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
        if not my_moki: continue
        champ_class = my_moki.get("class")
        allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]
        enemy_champ = next((e for e in enemy_team if not e.get("name", "").lower().startswith("moki #")), enemy_team[0] if enemy_team else None)
        enemy_champ_token_id = enemy_champ.get("mokiTokenId") if enemy_champ else 0
        enemy_champ_class = enemy_champ.get("class") if enemy_champ else "Unknown"
        enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != (enemy_champ.get("mokiTokenId") if enemy_champ else -1)]
        
        feat = {
            "moki_token_id": str(moki_id),
            "enemy_champ_token_id": str(enemy_champ_token_id),
            "moki_vs_enemy": f"{moki_id}_vs_{enemy_champ_token_id}",
            "champ_class": champ_class,
            "enemy_champ_class": enemy_champ_class
        }
        ally_classes = [a.get("class") for a in allies]
        enemy_ally_classes = [e.get("class") for e in enemy_allies]
        for cls in CLASSES:
            feat[f"ally_{cls}_count"] = ally_classes.count(cls)
            feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)
        features_list.append(feat)

    df_base = pd.DataFrame(features_list)
    
    # --- FASE 1: INFERENCIA MODELOS AUXILIARES ---
    df_base["pred_deaths"] = model_deaths.predict(df_base)
    df_base["pred_deposits"] = model_deposits.predict(df_base)
    df_base["pred_wartcloser"] = model_wartcloser.predict_proba(df_base)[:, 1]
    
    # --- FASE 2: INFERENCIA MODELOS PRINCIPALES (STACKING) ---
    win_probs = model_winrate.predict_proba(df_base)[:, 1]
    scores = model_score.predict(df_base)
    cond_probs = model_cond.predict_proba(df_base)
    avg_cond = cond_probs.mean(axis=0) * 100
    
    expected_deaths_sum = df_base["pred_deaths"].sum()
    expected_deposits_sum = df_base["pred_deposits"].sum() * 50
    avg_wartcloser_prob = df_base["pred_wartcloser"].mean() * 100
    expected_total_score = scores.sum()
    
    scheme_bonus = 0
    if scheme_name:
        scheme_data = next((s for s in SCHEME_RANKING["schemes"] if s["scheme"] == scheme_name), None)
        if scheme_data and champ_class in scheme_data["by_class"]:
            bonus_obj = scheme_data["by_class"][champ_class]
            if bonus_obj:
                ratio = len(matches) / SCHEME_RANKING["block_size"]
                scheme_bonus = bonus_obj["bonus"] * ratio
    
    final_score = expected_total_score + scheme_bonus

    return {
        "moki_token_id": moki_id,
        "champ_class": champ_class,
        "matches_count": len(matches),
        "predictions": {
            "expected_base_score_10m": round(expected_total_score, 1),
            "scheme_bonus": round(scheme_bonus, 1),
            "final_projected_score": round(final_score, 1),
            "avg_winrate": round(win_probs.mean() * 100, 1),
            "expected_deaths": round(expected_deaths_sum, 1),
            "expected_deposits": round(expected_deposits_sum, 1),
            "avg_wart_closer_prob": round(avg_wartcloser_prob, 1),
        },
        "win_conditions": {
            "Elimination": round(float(avg_cond[0]), 1),
            "Wart": round(float(avg_cond[1]), 1),
            "Gacha": round(float(avg_cond[2]), 1),
        }
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
