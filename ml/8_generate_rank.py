"""
Script 8 - Rank 180 Mokis
=========================
Descarga las 900 partidas, identifica a los 180 Moki Champions,
ejecuta las predicciones de CatBoost para cada uno y guarda un CSV
con el ranking final.
"""

import pandas as pd
import requests
import json
import os
import catboost as cb
from pathlib import Path
from dotenv import load_dotenv

# Cargar variables de entorno
ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv() # Fallback a variables de sistema (CI)

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# En CI, usamos la Service Role Key para mayor seguridad de escritura/lectura interna
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERROR] NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no están configurados.")
    exit(1)

MODELS_DIR = Path(__file__).parent / "models"

print("[INFO] Cargando modelos CatBoost...")
model_winrate = cb.CatBoostClassifier()
model_winrate.load_model(str(MODELS_DIR / "model_winrate.cbm"))

model_score = cb.CatBoostRegressor()
model_score.load_model(str(MODELS_DIR / "model_score.cbm"))

model_cond = cb.CatBoostClassifier()
model_cond.load_model(str(MODELS_DIR / "model_wincondition.cbm"))

model_deaths = cb.CatBoostRegressor()
model_deaths.load_model(str(MODELS_DIR / "model_deaths.cbm"))

model_deposits = cb.CatBoostRegressor()
model_deposits.load_model(str(MODELS_DIR / "model_deposits.cbm"))

model_wartcloser = cb.CatBoostClassifier()
model_wartcloser.load_model(str(MODELS_DIR / "model_wartcloser.cbm"))

print("[INFO] Cargando Metadata local...")
with open(Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json", "r", encoding="utf-8") as f:
    METADATA = json.load(f)

CLASSES = [
    "Anchor", "Bruiser", "Center", "Defender", "Flanker",
    "Forward", "Grinder", "Sprinter", "Striker", "Support"
]

def get_moki_stats_overrides():
    print("[INFO] Cargando moki_stats de Supabase para override de clases...")
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=name,class"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    res = requests.get(url, headers=headers).json()
    # Normalize keys: trimmed and lowercase
    return {str(row['name']).strip().lower(): row['class'] for row in res if row.get('name')}

def main():
    print("[INFO] Descargando partidas de Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/upcoming_matches_ga?select=*"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print("[ERROR] No se pudo conectar a Supabase")
        return
        
    data = response.json()
    print(f"[INFO] {len(data)} partidas descargadas.")

    # 0. Cargar overrides de moki_stats
    class_overrides = get_moki_stats_overrides()

    # 1. Encontrar a los 180 Mokis Campeones
    moki_counts = {}
    moki_details = {}
    
    for row in data:
        for team_name in ["team_red", "team_blue"]:
            team = row.get(team_name, [])
            if len(team) > 0:
                champ = team[0]
                mid = champ.get("mokiTokenId")
                name_key = str(champ.get("name", "")).strip().lower()
                
                # APLICAR OVERRIDE INMEDIATO
                if name_key in class_overrides:
                    champ["class"] = class_overrides[name_key]
                
                if mid:
                    moki_counts[mid] = moki_counts.get(mid, 0) + 1
                    moki_details[mid] = champ

    # Los bots/aliados suelen ser aleatorios. Los campeones son los que aparecen ~10 veces.
    # Vamos a tomar los IDs con mayor cantidad de apariciones (top 180)
    sorted_mokis = sorted(moki_counts.items(), key=lambda x: x[1], reverse=True)
    top_180 = [mid for mid, count in sorted_mokis[:180]]
    print(f"[INFO] {len(top_180)} Mokis identificados como Campeones para el torneo.")

    results = []

    for idx, moki_id in enumerate(top_180):
        # Filtrar sus matches (donde su ID aparece en red o blue)
        matches = []
        for row in data:
            red_ids = [m.get("mokiTokenId") for m in row.get("team_red", [])]
            blue_ids = [m.get("mokiTokenId") for m in row.get("team_blue", [])]
            if moki_id in red_ids or moki_id in blue_ids:
                matches.append(row)

        features_list = []
        champ_class = moki_details[moki_id].get("class")
        champ_name = moki_details[moki_id].get("name")
        
        for match in matches:
            team_red = match.get("team_red", [])
            team_blue = match.get("team_blue", [])
            
            red_ids = [m.get("mokiTokenId") for m in team_red]
            my_team = team_red if moki_id in red_ids else team_blue
            enemy_team = team_blue if moki_id in red_ids else team_red
            
            # APLICAR OVERRIDES A TODOS LOS MOKIS DEL PARTIDO
            for m in my_team + enemy_team:
                nk = str(m.get("name", "")).strip().lower()
                if nk in class_overrides:
                    m["class"] = class_overrides[nk]

            my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
            if not my_moki: continue
            
            champ_class_fixed = my_moki.get("class")
            allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]
            
            # Enemy champ 
            enemy_champ = next((e for e in enemy_team if not e.get("name", "").lower().startswith("moki #")), None)
            if not enemy_champ and len(enemy_team) > 0:
                enemy_champ = enemy_team[0]
            
            enemy_champ_class = enemy_champ.get("class") if enemy_champ else "Unknown"
            enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != (enemy_champ.get("mokiTokenId") if enemy_champ else -1)]
            
            feat = {
                "champ_class": champ_class_fixed,
                "enemy_champ_class": enemy_champ_class
            }
            
            ally_classes = [a.get("class") for a in allies]
            enemy_ally_classes = [e.get("class") for e in enemy_allies]
            
            for cls in CLASSES:
                feat[f"ally_{cls}_count"] = ally_classes.count(cls)
                feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)
                
            features_list.append(feat)

        if not features_list:
            continue

        df_feat = pd.DataFrame(features_list)
        
        win_probs = model_winrate.predict_proba(df_feat)[:, 1]
        scores = model_score.predict(df_feat)
        
        cond_probs = model_cond.predict_proba(df_feat) 
        avg_cond = cond_probs.mean(axis=0) * 100
        
        # Advanced inference
        pred_deaths = model_deaths.predict(df_feat)
        pred_deposits = model_deposits.predict(df_feat)
        prob_wartcloser = model_wartcloser.predict_proba(df_feat)[:, 1]
        
        expected_score = sum(scores)
        avg_wr = sum(win_probs) / len(win_probs) * 100
        
        elim_pct = float(avg_cond[0])
        wart_pct = float(avg_cond[1])
        gacha_pct = float(avg_cond[2])
        
        # New analytics maths
        expected_losses = len(matches) * ((100 - avg_wr) / 100)
        expected_wins_by_elim = len(matches) * (avg_wr / 100) * (elim_pct / 100)
        
        expected_deaths_sum = sum(pred_deaths)
        # 50 pts per deposit instance predicted
        expected_deposits_sum = sum(pred_deposits) * 50
        avg_wartcloser_prob = sum(prob_wartcloser) / len(prob_wartcloser) * 100 if len(prob_wartcloser) else 0
        expected_matches_closer = len(matches) * (avg_wartcloser_prob / 100)
        
        # Find traits
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
            "Class": champ_class,
            "Score": round(expected_score, 1),
            "WinRate": round(avg_wr, 1),
            "Wart Closer": round(expected_matches_closer, 1),
            "Losses": round(expected_losses, 1),
            "Gacha Pts": round(expected_deposits_sum, 1),
            "Deaths": round(expected_deaths_sum, 1),
            "Win By Combat": round(expected_wins_by_elim, 2),
            "Fur": fur,
            "Traits": traits,
            "Win Cond: Eliminations (%)": round(elim_pct, 1),
            "Win Cond: Wart (%)": round(wart_pct, 1),
            "Win Cond: Gacha (%)": round(gacha_pct, 1)
        })

    # Exportar a CSV
    df_results = pd.DataFrame(results)
    df_results = df_results.sort_values("Score", ascending=False)
    
    out_file = Path(__file__).parent / "data" / "upcoming_180_ranking.csv"
    df_results.to_csv(out_file, index=False, encoding="utf-8-sig")
    print(f"\n[OK] Ranking completado y guardado en {out_file}")
    
    # Mostrar el top 5 en consola
    print("\n--- TOP 5 MOKIS EXPECTED SCORES ---")
    print(df_results.head(5).to_string(index=False))

if __name__ == "__main__":
    main()
