"""
Script 10 — Generate V2 Striker Ranking (Optuna-Optimized Cascade)
===================================================================
Genera el ranking V2 ÚNICAMENTE para Strikers (incluyendo Sprinter (S) y Grinder (S))
usando los modelos Optuna-optimizados + features históricas de companions.

Output:
  - data/v2_ranking_striker.csv
"""

import pandas as pd
import numpy as np
import json
import catboost as cb
import requests
from pathlib import Path
from collections import defaultdict

from config import (
    DATA_DIR, V2_MODELS_DIR, EXISTING_MODELS_DIR, CLASSES,
    SUPABASE_URL, SUPABASE_KEY, supabase_headers,
    fetch_moki_stats, load_metadata, get_effective_class, get_display_class,
    ensure_dirs, print_separator
)

# ─── Load Historical Lookups ────────────────────────────────────────────────

def load_lookups():
    comp_path  = DATA_DIR / "companion_history_lookup.json"
    match_path = DATA_DIR / "matchup_history_lookup.json"

    comp_hist  = {}
    match_hist = {}

    if comp_path.exists():
        with open(comp_path) as f:
            comp_hist = json.load(f)

    if match_path.exists():
        with open(match_path) as f:
            match_hist = json.load(f)

    return comp_hist, match_hist

# ─── Load V2 Cascade Models ─────────────────────────────────────────────────

def load_striker_models():
    """Load Optuna-optimized Striker cascade models. Falls back to default cascade if not found."""
    model_dir = V2_MODELS_DIR / "striker"
    models    = {}

    for name, fname, fallback_fname in [
        ("duration", "optimized_duration.cbm", "cascade_duration.cbm"),
        ("deposits", "optimized_deposits.cbm", "cascade_deposits.cbm"),
        ("winrate",  "optimized_winrate.cbm",  "cascade_winrate.cbm"),
    ]:
        p = model_dir / fname
        if not p.exists():
            p = model_dir / fallback_fname
        if p.exists():
            if name == "winrate":
                models[name] = cb.CatBoostClassifier().load_model(str(p))
            else:
                models[name] = cb.CatBoostRegressor().load_model(str(p))
            print(f"  [OK] Loaded {name} from {p.name}")
        else:
            print(f"  [WARN] Model not found: {fname} (nor fallback {fallback_fname})")

    return models

# ─── Build Features ─────────────────────────────────────────────────────────

def build_v2_features(moki_id, matches, eff_overrides, comp_hist, match_hist):
    features_list = []

    for match in matches:
        team_red  = match.get("team_red",  [])
        team_blue = match.get("team_blue", [])
        red_ids   = [m.get("mokiTokenId") for m in team_red]
        am_red    = moki_id in red_ids

        my_team    = team_red  if am_red else team_blue
        enemy_team = team_blue if am_red else team_red

        my_moki = next((m for m in my_team if m.get("mokiTokenId") == moki_id), None)
        if not my_moki:
            continue

        allies = [m for m in my_team if m.get("mokiTokenId") != moki_id]

        # Enemy champion detection
        enemy_champ_id    = match.get("blue_champ_id") if am_red else match.get("red_champ_id")
        enemy_champ_class = match.get("blue_champ_class") if am_red else match.get("red_champ_class")

        if enemy_champ_id and enemy_champ_id in eff_overrides:
            enemy_champ_class = eff_overrides[enemy_champ_id]

        if not enemy_champ_class:
            enemy_champ = next(
                (e for e in enemy_team if not e.get("name", "").lower().startswith("moki #")),
                enemy_team[0] if enemy_team else None
            )
            enemy_champ_id    = enemy_champ.get("mokiTokenId") if enemy_champ else 0
            enemy_champ_class = eff_overrides.get(enemy_champ_id, enemy_champ.get("class", "Unknown")) if enemy_champ else "Unknown"

        enemy_allies = [e for e in enemy_team if e.get("mokiTokenId") != enemy_champ_id]

        def get_eff(m):
            mid = m.get("mokiTokenId")
            return eff_overrides.get(mid, m.get("class", "Unknown"))

        champ_cls          = get_eff(my_moki)
        ally_classes       = sorted([get_eff(a) for a in allies])
        enemy_cls          = enemy_champ_class or "Unknown"
        enemy_ally_classes = sorted([get_eff(e) for e in enemy_allies])

        team_comp    = "_".join([champ_cls.upper()] + [c.upper() for c in ally_classes])
        enemy_comp   = "_".join([enemy_cls.upper()]  + [c.upper() for c in enemy_ally_classes])
        matchup_key  = f"{champ_cls}_x_{enemy_cls}"

        feat = {
            "champ_class":       champ_cls,
            "enemy_champ_class": enemy_cls,
            "team_comp":         team_comp,
            "enemy_comp":        enemy_comp,
            "matchup_key":       matchup_key,
        }

        for cls in CLASSES:
            feat[f"ally_{cls}_count"]       = ally_classes.count(cls)
            feat[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)

        feat["ally1_class"] = ally_classes[0] if len(ally_classes) > 0 else ""
        feat["ally2_class"] = ally_classes[1] if len(ally_classes) > 1 else ""

        # Historical companion features
        champ_key   = champ_cls.lower()
        comp_lookup  = comp_hist.get(champ_key, {})
        match_lookup = match_hist.get(champ_key, {})
        pair_lookup  = match_hist.get(f"{champ_key}_pair", {})

        feat["hist_matchup_wr"] = match_lookup.get(matchup_key, {}).get("wr", 0.5)

        for idx, cls_name in enumerate([feat["ally1_class"], feat["ally2_class"]], 1):
            comp_data = comp_lookup.get(cls_name, {})
            feat[f"hist_wr_with_ally{idx}"]    = comp_data.get("wr", 0.5)
            feat[f"hist_kills_ally{idx}"]       = comp_data.get("avg_kills", 0)
            feat[f"hist_deposits_ally{idx}"]    = comp_data.get("avg_deposits", 0)
            feat[f"hist_wart_ally{idx}"]        = comp_data.get("avg_wart", 0)
            feat[f"hist_role_ally{idx}"]        = comp_data.get("dominant_role", "unknown")

        a1 = feat["ally1_class"]
        a2 = feat["ally2_class"]
        feat["hist_pair_wr"] = pair_lookup.get(f"{a1}_{a2}", {}).get("wr", 0.5)

        features_list.append(feat)

    return features_list

# ─── Cascade Prediction ─────────────────────────────────────────────────────

def cascade_predict_striker(df_feat, models):
    """Run V2 cascade prediction for Strikers. Returns (scores, win_probs, pred_deposits)."""
    dur_model = models.get("duration")
    dep_model = models.get("deposits")
    win_model = models.get("winrate")

    if not dur_model or not dep_model or not win_model:
        n = len(df_feat)
        return np.zeros(n), np.full(n, 0.5), np.zeros(n)

    # Phase 0: Predict duration
    X_p0 = df_feat.reindex(columns=dur_model.feature_names_, fill_value="").astype(str)
    pred_dur = np.maximum(0, dur_model.predict(X_p0))

    # Phase 1: Predict deposits (using pred_duration)
    df_p1 = df_feat.copy()
    df_p1["pred_duration"] = pred_dur
    X_p1 = df_p1.reindex(columns=dep_model.feature_names_, fill_value="").astype(str)
    pred_dep = np.maximum(0, dep_model.predict(X_p1))

    # Phase 2: Predict win (using pred_duration + pred_deposits)
    df_p2 = df_p1.copy()
    df_p2["pred_deposits"] = pred_dep
    X_p2 = df_p2.reindex(columns=win_model.feature_names_, fill_value="").astype(str)
    pred_wr = win_model.predict_proba(X_p2)[:, 1]

    score = pred_wr * 200 + pred_dep * 50
    return score, pred_wr, pred_dep

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ensure_dirs()

    # Load lookups
    comp_hist, match_hist = load_lookups()
    print(f"[INFO] Loaded companion history for {len(comp_hist)} classes")

    # Load upcoming matches
    print_separator("LOADING UPCOMING MATCHES")
    url = f"{SUPABASE_URL}/rest/v1/upcoming_matches_ga?select=*"
    headers = supabase_headers()

    data = []
    from_idx = 0
    while True:
        page_headers = {**headers, "Range": f"{from_idx}-{from_idx+999}", "Prefer": "count=exact"}
        r = requests.get(url, headers=page_headers, timeout=30)
        if r.status_code not in [200, 206]:
            break
        batch = r.json()
        if not batch:
            break
        data.extend(batch)
        if len(batch) < 1000:
            break
        from_idx += 1000

    print(f"[INFO] Loaded {len(data)} upcoming matches")

    # Load stats and metadata
    stats_map = fetch_moki_stats()
    metadata  = load_metadata()

    eff_overrides     = {}
    display_overrides = {}
    for mid, s in stats_map.items():
        eff_overrides[mid]     = get_effective_class(s["class"], s["dexterity"], s["strength"], s["defense"])
        display_overrides[mid] = get_display_class(s["class"],  s["dexterity"], s["strength"], s["defense"])

    # Map matches by moki — Strikers only
    moki_match_map = defaultdict(list)
    moki_details   = {}

    for row in data:
        for team_name, champ_id_col in [("team_red", "red_champ_id"), ("team_blue", "blue_champ_id")]:
            team = row.get(team_name, [])
            if not team:
                continue
            champ_id = row.get(champ_id_col)
            champ    = next((m for m in team if m.get("mokiTokenId") == champ_id), team[0]) if champ_id else team[0]
            mid      = champ.get("mokiTokenId")
            if not mid:
                continue

            eff_cls = eff_overrides.get(mid, champ.get("class", ""))
            if eff_cls != "Striker":   # Solo Strikers
                continue

            moki_match_map[mid].append(row)
            moki_details[mid] = champ

    print(f"[INFO] Found {len(moki_match_map)} Striker mokis with upcoming matches")

    # Load Striker models
    print_separator("LOADING STRIKER MODELS")
    models = load_striker_models()
    if len(models) < 3:
        print("[ERROR] Not enough models loaded. Aborting.")
        return

    # Generate ranking
    print_separator("GENERATING STRIKER RANKING")
    results = []

    for moki_id, details in moki_details.items():
        matches       = moki_match_map[moki_id]
        features_list = build_v2_features(moki_id, matches, eff_overrides, comp_hist, match_hist)

        if not features_list:
            continue

        df_feat = pd.DataFrame(features_list)
        scores, win_probs, pred_deposits = cascade_predict_striker(df_feat, models)

        champ_name = details.get("name", "Unknown")
        fur, traits = "", ""
        for key, val in metadata.items():
            if str(val.get("name", "")).lower().strip() == str(champ_name).lower().strip():
                fur    = val.get("fur", "")
                traits = ", ".join(val.get("traits", []))
                break

        results.append({
            "Moki ID":                moki_id,
            "Name":                   champ_name,
            "Class":                  display_overrides.get(moki_id, details.get("class", "")),
            "V2 Score":               round(scores.sum(), 1),
            "V2 WinRate":             round(win_probs.mean() * 100, 1),
            "Matches":                len(matches),
            "Avg Score Per Match":    round(scores.mean(), 1),
            "Avg Predicted Deposits": round(pred_deposits.mean(), 2),
            "Total Deposits":         round(pred_deposits.sum(), 1),
            "Fur":                    fur,
            "Traits":                 traits,
        })

    df_rank      = pd.DataFrame(results).sort_values("V2 Score", ascending=False)
    output_path  = DATA_DIR / "v2_ranking_striker.csv"
    df_rank.to_csv(output_path, index=False, encoding="utf-8-sig")

    print(f"\n[OK] Striker V2 ranking → {output_path} ({len(df_rank)} mokis)")
    print(df_rank.head(15).to_string(index=False))
    print("\n[DONE] V2 Striker ranking generated.")


if __name__ == "__main__":
    main()
