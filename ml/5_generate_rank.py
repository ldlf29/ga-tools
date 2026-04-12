"""
Script 8 - Rank Mokis by Class Composition
==========================================
Lee upcoming matches desde Supabase y genera el ranking de predicciones
usando composición pura de clases (sin IDs individuales de Moki).

Features: champ_class, enemy_champ_class, team_comp, enemy_comp,
          ally_*_count (x10), enemy_ally_*_count (x10)

Produce un único archivo CSV:
  - upcoming_180_ranking.csv : Ranking global (240 Mokis con predicciones)
"""

import pandas as pd
import requests
import json
import os
import catboost as cb
from pathlib import Path
from dotenv import load_dotenv
from collections import defaultdict

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists(): load_dotenv(ENV_PATH)
else: load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

MODELS_DIR = Path(__file__).parent / "models"

print("[INFO] Cargando modelos de Cascada para Ranking...")
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
    """Retorna dict {moki_id: class} con la clase ACTUAL de cada Moki desde Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=moki_id,class"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    try:
        res = requests.get(url, headers=headers).json()
        return {row["moki_id"]: row["class"] for row in res if row.get("moki_id")}
    except Exception as e:
        print("[WARN] Error fetching class overrides:", e)
        return {}

def build_features_for_moki(moki_id, matches, moki_details, class_overrides):
    """
    Construye la lista de features de CLASE para un Moki dado a través de sus partidas.
    Retorna una lista de dicts, uno por partida.
    No incluye IDs individuales — solo composición de clases.

    El enemy_champ se determina usando las columnas relacionales red_champ_id / blue_champ_id
    que están almacenadas directamente en cada fila de Supabase (upcoming_matches_ga).
    Esto es más robusto que parsear el nombre del JSONB.
    """
    features_list = []
    for match in matches:
        team_red, team_blue = match.get("team_red", []), match.get("team_blue", [])
        red_ids = [m.get("mokiTokenId") for m in team_red]
        am_red  = moki_id in red_ids
        my_team    = team_red  if am_red else team_blue
        enemy_team = team_blue if am_red else team_red

        # ── Aplicar class overrides usando moki_id (int) como clave ──────────
        # class_overrides = {moki_id (int): class (str)} desde moki_stats
        for m in my_team + enemy_team:
            mid = m.get("mokiTokenId")
            if mid and mid in class_overrides:
                m["class"] = class_overrides[mid]

        my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
        if not my_moki:
            continue

        allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]

        # ── Enemy champ: usar columnas relacionales de Supabase ──────────────
        # red_champ_id / blue_champ_id apuntan directamente al champion, sin parsear nombres.
        enemy_champ_id    = match.get("blue_champ_id") if am_red else match.get("red_champ_id")
        enemy_champ_class = match.get("blue_champ_class") if am_red else match.get("red_champ_class")

        # Aplicar override sobre la clase relacional también, por si cambió después del sync
        if enemy_champ_id and enemy_champ_id in class_overrides:
            enemy_champ_class = class_overrides[enemy_champ_id]

        # Fallback: si las columnas relacionales no están, parsear JSONB por nombre (legacy)
        if not enemy_champ_class:
            enemy_champ = next(
                (e for e in enemy_team if not e.get("name", "").lower().startswith("moki #")),
                enemy_team[0] if enemy_team else None
            )
            enemy_champ_id    = enemy_champ.get("mokiTokenId") if enemy_champ else 0
            enemy_champ_class = enemy_champ.get("class") if enemy_champ else "Unknown"

        enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != enemy_champ_id]

        # ── Composiciones ordenadas alfabéticamente (igual que en 2_preprocess.py) ──
        champ_cls          = my_moki.get("class") or "Unknown"
        ally_classes       = sorted([a.get("class") or "Unknown" for a in allies])
        enemy_cls          = enemy_champ_class or "Unknown"
        enemy_ally_classes = sorted([e.get("class") or "Unknown" for e in enemy_allies])

        team_comp  = "_".join([champ_cls.upper()] + [c.upper() for c in ally_classes])
        enemy_comp = "_".join([enemy_cls.upper()]  + [c.upper() for c in enemy_ally_classes])

        feat = {
            "champ_class":       champ_cls,
            "enemy_champ_class": enemy_cls,
            "team_comp":         team_comp,
            "enemy_comp":        enemy_comp,
        }
        for cls in CLASSES:
            feat[f"ally_{cls}_count"] = ally_classes.count(cls)
            
        for cls in CLASSES:
            feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)

        features_list.append(feat)

    return features_list

def predict_for_features(features_list):
    """Corre el pipeline de Cascada (Fase 1 → Fase 2) y retorna arrays de predicciones."""
    df_feat = pd.DataFrame(features_list)

    # FASE 1: Auxiliares (incluyen wart_distance si el modelo existe)
    df_feat["pred_deaths"]     = model_deaths.predict(df_feat).clip(min=0)
    df_feat["pred_kills"]      = model_kills.predict(df_feat).clip(min=0)
    df_feat["pred_deposits"]   = model_deposits.predict(df_feat).clip(min=0)
    df_feat["pred_wartcloser"] = model_wartcloser.predict_proba(df_feat)[:, 1]
    if model_wart_distance:
        df_feat["pred_wart_distance"] = model_wart_distance.predict(df_feat).clip(min=0)
    else:
        df_feat["pred_wart_distance"] = 0.0  # Placeholder hasta tener el modelo entrenado

    # FASE 2: Principales (con cascade features)
    win_probs  = model_winrate.predict_proba(df_feat)[:, 1]
    scores     = model_score.predict(df_feat).clip(min=0)
    cond_probs = model_cond.predict_proba(df_feat).mean(axis=0) * 100

    return df_feat, win_probs, scores, cond_probs

def get_metadata(champ_name):
    """Busca fur y traits en mokiMetadata.json por nombre."""
    for key, val in METADATA.items():
        if str(val.get("name")).lower().strip() == str(champ_name).lower().strip():
            return val.get("fur", ""), ", ".join(val.get("traits", []))
    return "", ""

def main():
    # ── Cargar upcoming matches desde Supabase ────────────────────────────────
    # ── Cargar upcoming matches desde Supabase (PAGINADO) ─────────────────────
    print("[INFO] Fetching ALL upcoming matches from Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/upcoming_matches_ga?select=*"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    
    data = []
    from_idx = 0
    to_idx = 999
    has_more = True
    
    while has_more:
        headers_page = {**headers, "Range": f"{from_idx}-{to_idx}", "Prefer": "count=exact"}
        response = requests.get(url, headers=headers_page)
        if response.status_code not in [200, 206]: # 200 (OK) or 206 (Partial Content)
            print(f"[ERROR] Error al conectar a Supabase: {response.status_code}")
            break
            
        batch = response.json()
        if not batch:
            has_more = False
            break
            
        data.extend(batch)
        print(f"[Supabase Pagination] Recuperadas filas {from_idx}-{to_idx}. Total: {len(data)}")
        
        if len(batch) < 1000:
            has_more = False
        else:
            from_idx += 1000
            to_idx += 1000

    if not data:
        print("[WARN] No hay upcoming matches en Supabase.")
        return

    class_overrides = get_moki_stats_overrides()
    print(f"[INFO] {len(class_overrides)} class overrides cargados.")

    # ── Mapear partidas por Moki ──────────────────────────────────────────────
    moki_counts    = {}
    moki_details   = {}
    moki_match_map = defaultdict(list)

    for row in data:
        # Usar columnas relacionales para identificar los champions de cada equipo
        for team_name, champ_id_col in [("team_red", "red_champ_id"), ("team_blue", "blue_champ_id")]:
            team = row.get(team_name, [])
            if not team:
                continue

            # El champion es el identificado por la columna relacional (más confiable que team[0])
            champ_id = row.get(champ_id_col)
            if champ_id:
                champ = next((m for m in team if m.get("mokiTokenId") == champ_id), team[0])
            else:
                champ = team[0]  # Fallback legacy si la columna relacional no está

            mid = champ.get("mokiTokenId")
            if not mid:
                continue

            # ── Aplicar override de clase usando moki_id (int) — FIX CRÍTICO ──
            # class_overrides es {moki_id (int): class (str)}, NO {nombre: class}
            if mid in class_overrides:
                champ["class"] = class_overrides[mid]

            moki_counts[mid]  = moki_counts.get(mid, 0) + 1
            moki_details[mid] = champ
            moki_match_map[mid].append(row)

    # Top 260 Mokis (cubre los 240 nuevos + buffer)
    top_mokis = [mid for mid, _ in sorted(moki_counts.items(), key=lambda x: x[1], reverse=True)[:260]]
    print(f"[INFO] Generando ranking para {len(top_mokis)} Mokis...")

    # ── Ranking Global ────────────────────────────────────────────────────────
    global_results = []

    for moki_id in top_mokis:
        matches       = moki_match_map[moki_id]
        champ_name    = moki_details[moki_id].get("name")
        current_class = moki_details[moki_id].get("class") or "Unknown"
        fur, traits   = get_metadata(champ_name)

        features_list = build_features_for_moki(moki_id, matches, moki_details, class_overrides)
        if not features_list:
            continue

        df_feat, win_probs, scores, cond_probs = predict_for_features(features_list)
        avg_wr = win_probs.mean() * 100

        global_results.append({
            "Moki ID":       moki_id,
            "Name":          champ_name,
            "Class":         current_class,
            "Score":         round(scores.sum(), 1),
            "WinRate":       round(avg_wr, 1),
            "Wart Closer":   round(len(matches) * df_feat["pred_wartcloser"].mean(), 1),
            "Losses":        round(len(matches) * ((100 - avg_wr) / 100), 1),
            "Gacha Pts":     round(df_feat["pred_deposits"].sum() * 50, 1),
            "Deaths":        round(df_feat["pred_deaths"].sum(), 1),
            "Kills":         round(df_feat["pred_kills"].sum(), 1),
            "Wart Distance": round(df_feat["pred_wart_distance"].sum(), 1),
            "Win By Combat": round(len(matches) * (avg_wr / 100) * (cond_probs[0] / 100), 2),
            "Fur":           fur,
            "Traits":        traits,
            "Win Cond: Eliminations (%)": round(cond_probs[0], 1),
            "Win Cond: Wart (%)":         round(cond_probs[1], 1),
            "Win Cond: Gacha (%)":        round(cond_probs[2], 1),
        })

    # ── Guardar CSV ───────────────────────────────────────────────────────────
    out_dir = Path(__file__).parent / "data"

    df_global = pd.DataFrame(global_results).sort_values("Score", ascending=False)
    global_path = out_dir / "upcoming_180_ranking.csv"
    df_global.to_csv(global_path, index=False, encoding="utf-8-sig")
    print(f"\n[OK] Ranking Global -> {global_path} ({len(df_global)} Mokis)")
    print(df_global.head(5).to_string(index=False))

if __name__ == "__main__":
    main()
