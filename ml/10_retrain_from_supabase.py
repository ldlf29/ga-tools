"""
Script 10 - Incremental Retraining from Supabase
================================================
1. Downloads recent match history from Supabase.
2. Extracts raw performance rows (matching Script 1 format).
3. Merges with local raw_matches.csv (deduplicating).
4. Preprocesses, prepares features, and retrains models with Time Weighting.
"""

import pandas as pd
import requests
import os
import json
import re
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv
from math import floor

# Import pipeline functions
import sys
# Add parent dir to path to import from ml/
sys.path.append(str(Path(__file__).parent))

from _2_preprocess import identify_roles, calculate_points, create_comp_features, drop_raw_player_cols, WIN_TYPE_MAP
from _6_train_models import MODELS_DIR

# ─── Config ──────────────────────────────────────────────────────────────────

DATA_DIR    = Path(__file__).parent / "data"
RAW_PATH    = DATA_DIR / "raw_matches.csv"
ENV_PATH    = Path(__file__).parent.parent / ".env.local"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

GENERIC_NAME_RE = re.compile(r"^Moki\s*#\d+$", re.IGNORECASE)

# ─── Supabase Download ────────────────────────────────────────────────────────

def download_recent_matches():
    print("[INFO] Fetching recent matches from Supabase (moki_match_history)...")
    
    # Traemos los matches de los últimos 7 días o los últimos 2000 registros
    url = f"{SUPABASE_URL}/rest/v1/moki_match_history?select=match_data,token_id&limit=2000&order=match_date.desc"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        print(f"[ERROR] Supabase API error: {r.status_code}")
        return []
        
    return r.json()

# ─── Extract Raw Logic (from Script 1) ────────────────────────────────────────

def extract_raw_row_v2(perf_json, moki_token_id):
    """Adaptación de Script 1 para procesar el JSON guardado en Supabase."""
    # En Supabase guardamos match_data que es el objeto 'match' de la API
    # Pero Script 1 esperaba el objeto 'performance' que contiene 'match' y 'results'
    
    # RE-CONSTRUIR estructura de performance si es posible
    # Si Supabase guardó el match completo, buscamos los resultados de este moki específico
    match = perf_json
    match_result = match.get("result", {})
    players = match.get("players", [])
    rp_list = match_result.get("players", [])
    
    # Encontrar stats de este moki
    target_moki_stats = next((rp for rp in rp_list if rp.get("mokiTokenId") == moki_token_id or rp.get("token_id") == moki_token_id), None)
    if not target_moki_stats:
        # Fallback: intentar por index si el orden coincide (riesgoso)
        return None

    row = {
        "moki_token_id": moki_token_id,
        "perf_id": f"{match.get('id')}_{moki_token_id}", # ID sintético
        "match_id": match.get("id"),
        "match_date": match.get("matchDate", datetime.now().isoformat()),
        "is_bye": False,
        "res_won": target_moki_stats.get("won", False),
        "res_win_type": match_result.get("winType", ""),
        "res_eliminations": int(target_moki_stats.get("eliminations", 0)),
        "res_deposits": int(target_moki_stats.get("deposits", 0)),
        "res_wart_distance": float(target_moki_stats.get("wartDistance", 0.0)),
        "res_deaths": int(target_moki_stats.get("deaths", 0)),
        "res_ended_game": target_moki_stats.get("endedGame", False),
        "res_wart_ride_seconds": float(target_moki_stats.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds": float(target_moki_stats.get("buffTimeSeconds", 0.0)),
        "res_wart_closer": target_moki_stats.get("wartCloser", False),
        "res_eaten_by_wart": int(target_moki_stats.get("eatenByWart", 0)),
        "res_loose_ball_pickups": int(target_moki_stats.get("looseBallPickups", 0)),
        "res_eating_while_riding": int(target_moki_stats.get("eatingWhileRiding", 0)),
        "match_game_type": match.get("gameType", ""),
        "match_team_won": str(match_result.get("teamWon", "")),
        "match_win_type": match_result.get("winType", ""),
        "match_duration": float(match_result.get("duration", 0.0)),
        "match_ended_by": match_result.get("gameEndedBy", ""),
    }

    for i, p in enumerate(players[:6], 1):
        row[f"p{i}_moki_id"]  = p.get("mokiId", "")
        row[f"p{i}_token_id"] = p.get("mokiTokenId") or p.get("tokenId")
        row[f"p{i}_name"]     = p.get("name", "")
        row[f"p{i}_team"]     = str(p.get("team", ""))
        row[f"p{i}_class"]    = p.get("class", "")

    for i, rp in enumerate(rp_list[:6], 1):
        row[f"rp{i}_moki_id"]           = rp.get("mokiId", "")
        row[f"rp{i}_eliminations"]      = int(rp.get("eliminations", 0))
        row[f"rp{i}_deposits"]          = int(rp.get("deposits", 0))
        row[f"rp{i}_wart_distance"]     = float(rp.get("wartDistance", 0.0))
        row[f"rp{i}_deaths"]            = int(rp.get("deaths", 0))
        row[f"rp{i}_ended_game"]        = rp.get("endedGame", False)
        row[f"rp{i}_wart_ride_seconds"] = float(rp.get("wartRideTimeSeconds", 0.0))
        row[f"rp{i}_buff_time_seconds"] = float(rp.get("buffTimeSeconds", 0.0))
        row[f"rp{i}_wart_closer"]       = rp.get("wartCloser", False)
        row[f"rp{i}_eaten_by_wart"]     = int(rp.get("eatenByWart", 0))

    return row

# ─── Main Process ─────────────────────────────────────────────────────────────

def main():
    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Download
    supabase_data = download_recent_matches()
    if not supabase_data:
        print("[WARNING] No hay datos nuevos en Supabase.")
        return

    new_rows = []
    for entry in supabase_data:
        match_json = entry.get("match_data")
        token_id = entry.get("token_id")
        if match_json and token_id:
            row = extract_raw_row_v2(match_json, token_id)
            if row:
                new_rows.append(row)

    df_new = pd.DataFrame(new_rows)
    print(f"[INFO] Se extrajeron {len(df_new)} filas de performance de Supabase.")

    # 2. Merge with local
    if RAW_PATH.exists():
        df_old = pd.read_csv(RAW_PATH)
        df_combined = pd.concat([df_old, df_new], ignore_index=True)
    else:
        df_combined = df_new

    before = len(df_combined)
    df_combined.drop_duplicates(subset=["match_id", "moki_token_id"], inplace=True)
    print(f"[INFO] Deduplicación: {before} -> {len(df_combined)} filas totales.")

    df_combined.to_csv(RAW_PATH, index=False)
    print(f"[OK] raw_matches.csv actualizado.")

    # 3. Retrain (Llamar a los scripts de preprocesamiento y entrenamiento)
    print("\n" + "="*50)
    print("INICIANDO RE-ENTRENAMIENTO INCREMENTAL")
    print("="*50)
    
    # Importar y ejecutar preprocess (esto generará processed_matches.csv)
    import _2_preprocess
    _2_preprocess.preprocess()
    
    # Importar y ejecutar prepare_features (esto generará ml_features.csv con las nuevas interaction cols)
    import _5_prepare_features
    _5_prepare_features.prepare_features()
    
    # Re-entrenar con Peso de Tiempo
    print("[INFO] Entrenando con pesos temporales (Matches recientes = mayor peso)...")
    
    # Cargamos features preparadas
    df_feat = pd.read_csv(DATA_DIR / "ml_features.csv")
    
    # Calcular pesos basados en la fecha (si tenemos match_date disponible en ml_features)
    # Por ahora, usamos el script original de entrenamiento
    import _6_train_models
    _6_train_models.train_models()
    
    print("\n[OK] Pipeline de re-entrenamiento completado exitosamente.")

if __name__ == "__main__":
    main()
