"""
Script Test - Generate Ranking from API for specific Future Contest
==================================================================
Este script descarga los partidos programados directamente desde la API de Grand Arena
para un Contest ID específico y genera el ranking localmente.
"""

import pandas as pd
import requests
import json
import os
import time
import catboost as cb
from pathlib import Path
from dotenv import load_dotenv
from collections import defaultdict

# ID solicitado por el usuario
TARGET_CONTEST_ID = "69eb51d763d702379f6c7b1a"

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists(): load_dotenv(ENV_PATH)
else: load_dotenv()

GA_API_KEY = os.getenv("GA_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

API_BASE_URL = "https://api.grandarena.gg/api/v1"
MODELS_DIR = Path(__file__).parent / "models"

if not GA_API_KEY:
    print("[ERROR] GA_API_KEY no encontrada en .env.local")
    exit(1)

print(f"[INFO] Generando ranking desde API para Contest ID: {TARGET_CONTEST_ID}")
print("[INFO] Cargando modelos de Cascada...")

# Auxiliares
model_deaths        = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deaths.cbm"))
model_kills         = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_kills.cbm"))
model_deposits      = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_deposits.cbm"))
model_wartcloser    = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wartcloser.cbm"))
model_wart_distance = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_wart_distance.cbm")) if (MODELS_DIR / "model_wart_distance.cbm").exists() else None

# Principales
model_winrate = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_winrate.cbm"))
model_score   = cb.CatBoostRegressor().load_model(str(MODELS_DIR / "model_score.cbm"))
model_cond    = cb.CatBoostClassifier().load_model(str(MODELS_DIR / "model_wincondition.cbm"))

with open(Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json", "r", encoding="utf-8") as f:
    METADATA = json.load(f)

CLASSES = ["Anchor", "Bruiser", "Center", "Defender", "Flanker", "Forward", "Grinder", "Sprinter", "Striker", "Support"]

def get_moki_stats_overrides():
    """Fetching moki_stats from Supabase to handle class overrides (Sprinter/Grinder split)"""
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=moki_id,class,dexterity,strength,defense"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    real_overrides = {}
    eff_overrides = {}
    moki_stats_ids = set()
    try:
        res = requests.get(url, headers=headers).json()
        for row in res:
            mid = row.get("moki_id")
            if not mid: continue
            moki_stats_ids.add(mid)
            base_cls = str(row.get("class", ""))
            real_overrides[mid] = base_cls
            eff_cls = base_cls
            if base_cls == "Grinder":
                dex, str_val = float(row.get("dexterity", 0)), float(row.get("strength", 0))
                eff_cls = "Striker" if dex > str_val else "Bruiser"
            elif base_cls == "Sprinter":
                dex, def_val = float(row.get("dexterity", 0)), float(row.get("defense", 0))
                eff_cls = "Striker" if dex > def_val else "Defender"
            eff_overrides[mid] = eff_cls
        return real_overrides, eff_overrides, moki_stats_ids
    except Exception as e:
        print("[WARN] Error fetching class overrides:", e)
        return {}, {}, set()

def build_features_for_moki(moki_id, matches, moki_details, effective_class_overrides, moki_stats_ids):
    features_list = []
    for match in matches:
        team_red, team_blue = match.get("team_red", []), match.get("team_blue", [])
        red_ids = [m.get("mokiTokenId") for m in team_red]
        am_red  = moki_id in red_ids
        my_team    = team_red  if am_red else team_blue
        enemy_team = team_blue if am_red else team_red

        def get_eff_class(m_obj):
            mid = m_obj.get("mokiTokenId")
            if mid and mid in effective_class_overrides: return effective_class_overrides[mid]
            return m_obj.get("class") or "Unknown"

        my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
        if not my_moki: continue
        allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]
        
        # Identificar champions (como en cron_sync_upcoming.ts)
        def find_champ(team):
            # El champion es el que está en moki_stats
            for p in team:
                if p.get("mokiTokenId") in moki_stats_ids:
                    return p
            # Fallback legacy
            return next((p for p in team if not p.get("name", "").lower().startswith("moki #")), team[0] if team else None)

        red_champ = find_champ(team_red)
        blue_champ = find_champ(team_blue)
        
        enemy_champ = blue_champ if am_red else red_champ
        enemy_champ_id = enemy_champ.get("mokiTokenId") if enemy_champ else 0
        enemy_champ_class = get_eff_class(enemy_champ) if enemy_champ else "Unknown"

        enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != enemy_champ_id]
        champ_cls          = get_eff_class(my_moki)
        ally_classes       = sorted([get_eff_class(a) for a in allies])
        enemy_cls          = enemy_champ_class or "Unknown"
        enemy_ally_classes = sorted([get_eff_class(e) for e in enemy_allies])
        team_comp  = "_".join([champ_cls.upper()] + [c.upper() for c in ally_classes])
        enemy_comp = "_".join([enemy_cls.upper()]  + [c.upper() for c in enemy_ally_classes])
        feat = { "champ_class": champ_cls, "enemy_champ_class": enemy_cls, "team_comp": team_comp, "enemy_comp": enemy_comp }
        for cls in CLASSES: feat[f"ally_{cls}_count"] = ally_classes.count(cls)
        for cls in CLASSES: feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)
        features_list.append(feat)
    return features_list

def predict_for_features(features_list):
    df_feat = pd.DataFrame(features_list)
    df_feat["pred_deaths"]     = model_deaths.predict(df_feat).clip(min=0)
    df_feat["pred_kills"]      = model_kills.predict(df_feat).clip(min=0)
    df_feat["pred_deposits"]   = model_deposits.predict(df_feat).clip(min=0)
    df_feat["pred_wartcloser"] = model_wartcloser.predict_proba(df_feat)[:, 1]
    df_feat["pred_wartdistance"] = model_wart_distance.predict(df_feat).clip(min=0) if model_wart_distance else 0.0
    win_probs  = model_winrate.predict_proba(df_feat)[:, 1]
    scores     = model_score.predict(df_feat).clip(min=0)
    cond_probs = model_cond.predict_proba(df_feat).mean(axis=0) * 100
    return df_feat, win_probs, scores, cond_probs

def get_metadata(champ_name):
    for key, val in METADATA.items():
        if str(val.get("name")).lower().strip() == str(champ_name).lower().strip():
            return val.get("fur", ""), ", ".join(val.get("traits", []))
    return "", ""

def fetch_matches_from_api(contest_id):
    print(f"[API] Fetching matches for Contest {contest_id}...")
    headers = { "Accept": "application/json", "Authorization": f"Bearer {GA_API_KEY}" }
    all_matches = []
    page = 1
    while True:
        url = f"{API_BASE_URL}/contests/{contest_id}/matches?page={page}&limit=100&state=scheduled"
        try:
            r = requests.get(url, headers=headers, timeout=30)
            r.raise_for_status()
            batch = r.json().get("data", [])
            if not batch: break
            all_matches.extend(batch)
            print(f"  Página {page}: {len(batch)} matches obtenidos.")
            if len(batch) < 100: break
            page += 1
            time.sleep(1)
        except Exception as e:
            print(f"  [ERROR] Error en API: {e}")
            break
    return all_matches

def main():
    real_class_overrides, effective_class_overrides, moki_stats_ids = get_moki_stats_overrides()
    
    # 1. Fetch matches directly from API
    matches_raw = fetch_matches_from_api(TARGET_CONTEST_ID)
    if not matches_raw:
        print(f"[ERROR] No se obtuvieron partidas para el contest {TARGET_CONTEST_ID}")
        return

    # 2. Reformat to match Python pipeline expectations
    formatted_data = []
    for m in matches_raw:
        team_red  = [p for p in m.get("players", []) if p.get("team") == "red"]
        team_blue = [p for p in m.get("players", []) if p.get("team") == "blue"]
        formatted_data.append({
            "id": m.get("id"),
            "team_red": team_red,
            "team_blue": team_blue,
        })

    print(f"[INFO] {len(formatted_data)} partidas cargadas desde API.")

    moki_counts, moki_details, moki_match_map = {}, {}, defaultdict(list)

    for row in formatted_data:
        for team_name in ["team_red", "team_blue"]:
            team = row.get(team_name, [])
            if not team: continue
            
            # El champion es el identificado en moki_stats
            champ = next((p for p in team if p.get("mokiTokenId") in moki_stats_ids), team[0])
            mid = champ.get("mokiTokenId")
            if not mid: continue
            
            if mid in real_class_overrides: champ["class"] = real_class_overrides[mid]
            moki_counts[mid]  = moki_counts.get(mid, 0) + 1
            moki_details[mid] = champ
            moki_match_map[mid].append(row)

    top_mokis = [mid for mid, _ in sorted(moki_counts.items(), key=lambda x: x[1], reverse=True)]
    print(f"[INFO] Generando ranking para {len(top_mokis)} Mokis...")

    results = []
    for moki_id in top_mokis:
        matches = moki_match_map[moki_id]
        champ_name = moki_details[moki_id].get("name")
        current_class = moki_details[moki_id].get("class") or "Unknown"
        fur, traits = get_metadata(champ_name)
        features_list = build_features_for_moki(moki_id, matches, moki_details, effective_class_overrides, moki_stats_ids)
        if not features_list: continue
        df_feat, win_probs, scores, cond_probs = predict_for_features(features_list)
        avg_wr = win_probs.mean() * 100
        results.append({
            "Moki ID": moki_id, "Name": champ_name, "Class": current_class,
            "Score": round(scores.sum(), 1), "WinRate": round(avg_wr, 1),
            "Wart Closer": round(len(matches) * df_feat["pred_wartcloser"].mean(), 1),
            "Losses": round(len(matches) * ((100 - avg_wr) / 100), 1),
            "Deposits": round(df_feat["pred_deposits"].sum(), 1),
            "Kills": round(df_feat["pred_kills"].sum(), 1),
            "Fur": fur, "Traits": traits,
            "Matches": len(matches)
        })

    df = pd.DataFrame(results).sort_values("Score", ascending=False)
    out_path = Path(__file__).parent / "data" / f"ranking_api_contest_{TARGET_CONTEST_ID}.csv"
    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n[OK] Ranking del Contest {TARGET_CONTEST_ID} (via API) guardado en: {out_path}")
    print(df.head(10).to_string(index=False))

if __name__ == "__main__":
    main()
