"""
Script 6 — Entrenamiento de Modelos CatBoost
=============================================
Entrena modelos usando composición de clases como features principales.

Features: champ_class, enemy_champ_class, team_comp, enemy_comp,
          ally_*_count (x10), enemy_ally_*_count (x10)

Sin IDs individuales de Moki. El modelo aprende patrones de clase,
no de identidades específicas.

Time Weighting:
  - ≤ 3 días: x1.5  (data muy reciente, muy relevante)
  - ≤ 7 días: x1.25 (data reciente)
  - > 7 días: x1.0  (data histórica base)

Arquitectura de Cascada (Stacking):
  Fase 1 — Modelos Auxiliares: Deaths, Kills, Deposits, WartCloser
  Fase 2 — Modelos Principales: WinRate, Score, WinCondition
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from catboost import CatBoostClassifier, CatBoostRegressor
import os
import json
from datetime import datetime

# ─── Rutas ───────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "data"
MODELS_DIR  = Path(__file__).parent / "models"
INPUT_PATH  = DATA_DIR / "ml_features.csv"

def load_best_params(model_name):
    path = DATA_DIR / f"best_params_{model_name.lower().replace(' ', '_')}.json"
    if path.exists():
        with open(path, "r") as f:
            return json.load(f)
    return {}

def calculate_time_weights(dates_series):
    """
    Pondera más los matches recientes:
      ≤ 3 días  → x1.50
      ≤ 7 días  → x1.25
      > 7 días  → x1.00
    """
    try:
        dates = pd.to_datetime(dates_series).dt.date
        today = datetime.now().date()
        weights = []
        for d in dates:
            diff = (today - d).days
            if diff <= 3:
                weights.append(1.5)
            elif diff <= 7:
                weights.append(1.25)
            else:
                weights.append(1.0)
        return np.array(weights)
    except Exception as e:
        print(f"[WARN] Error calculando pesos temporales: {e}. Usando peso 1.0.")
        return np.ones(len(dates_series))

def train_models():
    print(f"[INFO] Leyendo dataset {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH)

    df["is_win"]        = df["is_win"].astype(int)
    df["total_points"]  = df["total_points"].astype(float)
    df["match_date"]    = df["match_date"].fillna(datetime.now().isoformat())
    df["champ_class"]   = df["champ_class"].fillna("Unknown")
    df["enemy_champ_class"] = df["enemy_champ_class"].fillna("Unknown")
    df["team_comp"]     = df["team_comp"].fillna("Unknown_Unknown_Unknown")
    df["enemy_comp"]    = df["enemy_comp"].fillna("Unknown_Unknown_Unknown")

    # Features categóricas (solo clases y composiciones)
    cat_features = ["champ_class", "enemy_champ_class", "team_comp", "enemy_comp"]

    target_cols = [
        "is_win", "total_points", "win_condition",
        "res_deaths", "res_eliminations", "res_deposits", "res_wart_closer",
        "match_date"
    ]

    base_feature_cols = [c for c in df.columns if c not in target_cols]
    X_base = df[base_feature_cols].astype(str)
    sample_weights = calculate_time_weights(df["match_date"])

    print(f"[INFO] Shape X_base: {X_base.shape}")
    print(f"[INFO] Distribución de pesos temporales: media={sample_weights.mean():.3f}, min={sample_weights.min():.2f}, max={sample_weights.max():.2f}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # ── FASE 1: Modelos Auxiliares ────────────────────────────────────────────
    print("\n" + "="*55)
    print("FASE 1: ENTRENAMIENTO DE MODELOS AUXILIARES")
    print("="*55)

    aux_configs = [
        {"name": "Deaths",     "class": CatBoostRegressor,  "target": "res_deaths",      "file": "model_deaths.cbm",     "metric": "RMSE"},
        {"name": "Kills",      "class": CatBoostRegressor,  "target": "res_eliminations", "file": "model_kills.cbm",      "metric": "RMSE"},
        {"name": "Deposits",   "class": CatBoostRegressor,  "target": "res_deposits",    "file": "model_deposits.cbm",   "metric": "RMSE"},
        {"name": "WartCloser", "class": CatBoostClassifier, "target": "res_wart_closer",  "file": "model_wartcloser.cbm", "metric": "Accuracy"},
    ]

    for cfg in aux_configs:
        if cfg["target"] not in df.columns:
            print(f"[SKIP] {cfg['name']}: columna '{cfg['target']}' no encontrada en el dataset.")
            continue

        print(f"\n[AUX] Entrenando {cfg['name']}...")
        y_aux = df[cfg["target"]].fillna(0).astype(
            float if cfg["class"] == CatBoostRegressor else int
        )

        X_t, X_v, y_t, y_v, w_t, _ = train_test_split(
            X_base, y_aux, sample_weights, test_size=0.2, random_state=42
        )

        model = cfg["class"](
            iterations=500, learning_rate=0.05, depth=6,
            eval_metric=cfg["metric"], random_seed=42, verbose=False
        )
        model.fit(X_t, y_t, cat_features=cat_features, sample_weight=w_t,
                  eval_set=(X_v, y_v), use_best_model=True)
        model.save_model(str(MODELS_DIR / cfg["file"]))
        print(f"[OK] {cfg['name']} guardado en {cfg['file']}")

        # Predicciones para usar como features de stacking
        if cfg["class"] == CatBoostClassifier:
            df[f"pred_{cfg['name'].lower()}"] = model.predict_proba(X_base)[:, 1]
        else:
            df[f"pred_{cfg['name'].lower()}"] = model.predict(X_base)

    # ── FASE 2: Modelos Principales (Stacking) ────────────────────────────────
    print("\n" + "="*55)
    print("FASE 2: ENTRENAMIENTO DE MODELOS PRINCIPALES (STACKING)")
    print("="*55)

    cascade_features = [f"pred_{cfg['name'].lower()}" for cfg in aux_configs
                        if cfg["target"] in df.columns]
    X_cascade = pd.concat([X_base, df[cascade_features]], axis=1)

    def fit_main(model_class, target_col, name, filename, params_name):
        print(f"\n[MAIN] Entrenando {name}...")
        y = df[target_col].astype(float if model_class == CatBoostRegressor else int)

        X_t, X_v, y_t, y_v, w_t, _ = train_test_split(
            X_cascade, y, sample_weights, test_size=0.2, random_state=42
        )

        best_params = load_best_params(params_name)
        params = {
            "iterations": 1000, "learning_rate": 0.05, "depth": 6,
            "random_seed": 42, "verbose": 100
        }
        params.update(best_params)

        model = model_class(**params)
        model.fit(X_t, y_t, cat_features=cat_features, sample_weight=w_t,
                  eval_set=(X_v, y_v), use_best_model=True)
        model.save_model(str(MODELS_DIR / filename))
        print(f"[OK] {name} guardado en {filename}")

    fit_main(CatBoostClassifier, "is_win",       "Modelo WinRate",        "model_winrate.cbm", "WinRate Model")
    fit_main(CatBoostRegressor,  "total_points", "Modelo Expected Score", "model_score.cbm",   "Score Model")

    # Win Condition (Multiclase)
    print("\n[MAIN] Entrenando Win Condition...")
    wins_df = df[df["is_win"] == 1].copy()
    wins_df = wins_df.dropna(subset=["win_condition"])
    X_w = wins_df[base_feature_cols + cascade_features].astype({c: str for c in base_feature_cols})
    y_w = wins_df["win_condition"].astype(str)
    w_w = sample_weights[wins_df.index]

    X_t, X_v, y_t, y_v, w_t, _ = train_test_split(X_w, y_w, w_w, test_size=0.2, random_state=42)
    model_cond = CatBoostClassifier(
        iterations=500, learning_rate=0.05, depth=6,
        loss_function="MultiClass", random_seed=42, verbose=100
    )
    model_cond.fit(X_t, y_t, cat_features=cat_features, sample_weight=w_t,
                   eval_set=(X_v, y_v), use_best_model=True)
    model_cond.save_model(str(MODELS_DIR / "model_wincondition.cbm"))

    print("\n[INFO] Entrenamiento en Cascada finalizado exitosamente.")
    print(f"[INFO] Modelos guardados en: {MODELS_DIR}")

if __name__ == "__main__":
    train_models()
