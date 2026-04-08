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

import importlib
_preprocess   = importlib.import_module("2_preprocess")
_train_models = importlib.import_module("4_train_models")

identify_roles       = _preprocess.identify_roles
calculate_points     = _preprocess.calculate_points
create_comp_features = _preprocess.create_comp_features
drop_raw_player_cols = _preprocess.drop_raw_player_cols
WIN_TYPE_MAP         = _preprocess.WIN_TYPE_MAP
MODELS_DIR           = _train_models.MODELS_DIR

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
    print("[INFO] Fetching matches from Supabase (moki_match_history) with pagination...")
    
    url = f"{SUPABASE_URL}/rest/v1/moki_match_history?select=match_data,token_id&order=match_date.desc"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    all_data = []
    from_idx = 0
    to_idx = 999
    has_more = True
    
    while has_more:
        headers_page = {**headers, "Range": f"{from_idx}-{to_idx}", "Prefer": "count=exact"}
        r = requests.get(url, headers=headers_page)
        if r.status_code not in [200, 206]:
            print(f"[ERROR] API error fetching matches: {r.status_code}")
            break
            
        batch = r.json()
        if not batch:
            has_more = False
            break
            
        all_data.extend(batch)
        print(f"[Supabase Pagination] Descargadas filas {from_idx}-{to_idx}. Total acumulado: {len(all_data)}")
        
        if len(batch) < 1000:
            has_more = False
        else:
            from_idx += 1000
            to_idx += 1000
            
    return all_data

# ─── Extract Raw Logic (from Script 1) ────────────────────────────────────────

def extract_raw_row_v2(perf_json, moki_token_id):
    """Adaptación de Script 1 para procesar el JSON guardado en Supabase."""
    match        = perf_json
    match_result = match.get("result", {})
    players      = match.get("players", [])     # Tiene mokiTokenId + mokiId + class
    rp_list      = match_result.get("players", [])  # Tiene mokiId + stats (sin mokiTokenId)

    # Paso 1: encontrar al moki por mokiTokenId en match_data.players
    target_player = next(
        (p for p in players if p.get("mokiTokenId") == moki_token_id),
        None
    )
    if not target_player:
        return None

    # Paso 2: obtener su mokiId para buscar en result.players
    target_moki_id = target_player.get("mokiId")

    # Paso 3: buscar estadísticas en result.players usando mokiId
    target_moki_stats = next(
        (rp for rp in rp_list if rp.get("mokiId") == target_moki_id),
        None
    )
    if not target_moki_stats:
        return None

    row = {
        "moki_token_id": moki_token_id,
        "perf_id":       f"{match.get('id')}_{moki_token_id}",
        "match_id":      match.get("id"),
        "match_date":    match.get("matchDate", datetime.now().isoformat()),
        "is_bye":        False,
        "res_won":          target_player.get("won", target_moki_stats.get("won", False)),
        "res_win_type":     match_result.get("winType", ""),
        "res_eliminations": int(target_moki_stats.get("eliminations", 0)),
        "res_deposits":     int(target_moki_stats.get("deposits", 0)),
        "res_wart_distance":     float(target_moki_stats.get("wartDistance", 0.0)),
        "res_deaths":            int(target_moki_stats.get("deaths", 0)),
        "res_ended_game":        target_moki_stats.get("endedGame", False),
        "res_wart_ride_seconds": float(target_moki_stats.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds": float(target_moki_stats.get("buffTimeSeconds", 0.0)),
        "res_wart_closer":       target_moki_stats.get("wartCloser", False),
        "res_eaten_by_wart":     int(target_moki_stats.get("eatenByWart", 0)),
        "res_loose_ball_pickups":    int(target_moki_stats.get("looseBallPickups", 0)),
        "res_eating_while_riding":   int(target_moki_stats.get("eatingWhileRiding", 0)),
        "match_game_type":  match.get("gameType", ""),
        "match_team_won":   str(match_result.get("teamWon", "")),
        "match_win_type":   match_result.get("winType", ""),
        "match_duration":   float(match_result.get("duration", 0.0)),
        "match_ended_by":   match_result.get("gameEndedBy", ""),
    }

    # Determinar si ganó: el teamWon coincide con el team del jugador
    team_won = str(match_result.get("teamWon", "")).lower()
    player_team = str(target_player.get("team", "")).lower()
    row["res_won"] = (team_won == player_team) if team_won and player_team else False

    for i, p in enumerate(players[:6], 1):
        row[f"p{i}_moki_id"]  = p.get("mokiId", "")
        row[f"p{i}_token_id"] = p.get("mokiTokenId")
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

    if df_new.empty:
        print("[WARNING] No se pudieron extraer filas válidas de los datos de Supabase.")
        print("[WARNING] Skipping retrain — se usará el modelo previo.")
        return

    # 2. Merge with local
    if RAW_PATH.exists():
        try:
            df_old = pd.read_csv(RAW_PATH)
            if df_old.empty:
                df_combined = df_new
            else:
                df_combined = pd.concat([df_old, df_new], ignore_index=True)
        except Exception:
            print("[WARN] No se pudo leer raw_matches.csv existente, usando solo data de Supabase.")
            df_combined = df_new
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
    
    # Importar y ejecutar preprocess (genera processed_matches.csv)
    preprocess_mod = importlib.import_module("2_preprocess")
    preprocess_mod.preprocess()

    # Importar y ejecutar prepare_features (genera ml_features.csv)
    prepare_mod = importlib.import_module("3_prepare_features")
    prepare_mod.prepare_features()

    # Re-entrenar con Peso de Tiempo
    print("[INFO] Entrenando con pesos temporales (Matches recientes = mayor peso)...")
    train_mod = importlib.import_module("4_train_models")
    train_mod.train_models()
    
    print("\n[OK] Pipeline de re-entrenamiento completado exitosamente.")

if __name__ == "__main__":
    main()
