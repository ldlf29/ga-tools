"""
Script 6 — Entrenamiento de Modelos CatBoost
=============================================
Entrena 3 modelos utilizando las 22 variables proyectadas de composición:
1. Modelo WinRate (Clasificación Binaria) -> `model_winrate.cbm`
2. Modelo Expected Score (Regresión) -> `model_score.cbm`
3. Modelo Win Condition (Multiclase, sólo para wins) -> `model_wincondition.cbm`
"""

import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split
from catboost import CatBoostClassifier, CatBoostRegressor
import os

# ─── Rutas ───────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "data"
MODELS_DIR  = Path(__file__).parent / "models"
INPUT_PATH  = DATA_DIR / "ml_features.csv"

def train_models():
    print(f"[INFO] Leyendo dataset {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH)
    
    # Manejar posibles strings raros en win_condition o targets
    df["is_win"] = df["is_win"].astype(int)
    df["total_points"] = df["total_points"].astype(float)
    
    # Rellenar posibles valores nulos en clases (si quedó alguno)
    df["champ_class"] = df["champ_class"].fillna("Unknown")
    df["enemy_champ_class"] = df["enemy_champ_class"].fillna("Unknown")

    # Separar Features (X) y Targets (y)
    target_cols = [
        "is_win", "total_points", "win_condition",
        "res_deaths", "res_deposits", "res_wart_closer"
    ]
    
    # Algunas cols podrían estar vacías, pero no pasa nada si están en target_cols evitamos que entren de features
    available_targets = [c for c in target_cols if c in df.columns]
    feature_cols = [c for c in df.columns if c not in available_targets]
    
    X = df[feature_cols]
    
    y_win = df["is_win"].astype(int)
    y_score = df["total_points"].astype(float)
    
    # Nuevos y (Targets)
    y_deaths = df["res_deaths"].astype(float)
    y_deposits = df["res_deposits"].astype(float)
    y_wart_closer = df["res_wart_closer"].fillna(False).astype(int)
    
    # Features Categóricas
    cat_features = ["champ_class", "enemy_champ_class"]
    print(f"[INFO] Features ({len(feature_cols)}): {feature_cols}")
    
    # Split datos generales (80/20) para todos los modelos usando los mismos índices
    X_train, X_test, idx_train, idx_test = train_test_split(
        X, df.index, test_size=0.2, random_state=42
    )

    y_win_train, y_win_test = y_win.loc[idx_train], y_win.loc[idx_test]
    y_score_train, y_score_test = y_score.loc[idx_train], y_score.loc[idx_test]
    
    # splits de variables extendidas
    y_deaths_train, y_deaths_test = y_deaths.loc[idx_train], y_deaths.loc[idx_test]
    y_deposits_train, y_deposits_test = y_deposits.loc[idx_train], y_deposits.loc[idx_test]
    y_wart_closer_train, y_wart_closer_test = y_wart_closer.loc[idx_train], y_wart_closer.loc[idx_test]
    
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    
    # ─── MODELO A: WINRATE (CLASIFICACIÓN) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo A - WinRate (CatBoostClassifier)")
    print("="*50)
    
    model_win = CatBoostClassifier(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        eval_metric='Accuracy',
        random_seed=42,
        verbose=100
    )
    
    model_win.fit(
        X_train, y_win_train,
        cat_features=cat_features,
        eval_set=(X_test, y_win_test),
        use_best_model=True
    )
    
    out_win = MODELS_DIR / "model_winrate.cbm"
    model_win.save_model(str(out_win))
    print(f"[OK] Modelo WinRate guardado en {out_win}")
    
    # ─── MODELO B: EXPECTED SCORE (REGRESIÓN) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo B - Expected Score (CatBoostRegressor)")
    print("="*50)
    
    # Para el score podemos entrenar sobre todos los datos
    model_score = CatBoostRegressor(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        eval_metric='RMSE',
        random_seed=42,
        verbose=100
    )
    
    model_score.fit(
        X_train, y_score_train,
        cat_features=cat_features,
        eval_set=(X_test, y_score_test),
        use_best_model=True
    )
    
    out_score = MODELS_DIR / "model_score.cbm"
    model_score.save_model(str(out_score))
    print(f"[OK] Modelo Expected Score guardado en {out_score}")

    # ─── MODELO C: WIN CONDITION (CLASIFICACIÓN MULTICLASE) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo C - Win Condition (Sólo Victorias)")
    print("="*50)
    
    # Filtrar solo victorias
    wins_df = df[df["is_win"] == 1].copy()
    wins_df = wins_df.dropna(subset=["win_condition"])
    
    X_wins = wins_df[feature_cols]
    y_cond = wins_df["win_condition"].astype(str)
    
    X_train_c, X_test_c, y_cond_train, y_cond_test = train_test_split(
        X_wins, y_cond, test_size=0.2, random_state=42
    )

    model_cond = CatBoostClassifier(
        iterations=500,
        learning_rate=0.05,
        depth=6,
        eval_metric='MultiClass',
        loss_function='MultiClass',
        random_seed=42,
        verbose=100
    )
    
    model_cond.fit(
        X_train_c, y_cond_train,
        cat_features=cat_features,
        eval_set=(X_test_c, y_cond_test),
        use_best_model=True
    )
    
    out_cond = MODELS_DIR / "model_wincondition.cbm"
    model_cond.save_model(str(out_cond))
    print(f"[OK] Modelo Win Condition guardado en {out_cond}")

    # ─── MODELO EXT 1: EXPECTED DEATHS (REGRESIÓN) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo EXT 1 - Expected Deaths (Regresión)")
    print("="*50)
    
    model_deaths = CatBoostRegressor(
        iterations=300, learning_rate=0.05, depth=6, eval_metric='RMSE', random_seed=42, verbose=100
    )
    model_deaths.fit(X_train, y_deaths_train, cat_features=cat_features, eval_set=(X_test, y_deaths_test), use_best_model=True)
    out_deaths = MODELS_DIR / "model_deaths.cbm"
    model_deaths.save_model(str(out_deaths))
    
    # ─── MODELO EXT 2: EXPECTED GACHA POINTS DEPOSITS (REGRESIÓN) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo EXT 2 - Expected Gacha Deposits (Regresión)")
    print("="*50)
    
    model_deposits = CatBoostRegressor(
        iterations=300, learning_rate=0.05, depth=6, eval_metric='RMSE', random_seed=42, verbose=100
    )
    model_deposits.fit(X_train, y_deposits_train, cat_features=cat_features, eval_set=(X_test, y_deposits_test), use_best_model=True)
    out_deposits = MODELS_DIR / "model_deposits.cbm"
    model_deposits.save_model(str(out_deposits))
    
    # ─── MODELO EXT 3: WART CLOSER (CLASIFICADOR BINARIO) ───
    print("\n" + "="*50)
    print("[ENTRENAMIENTO] Modelo EXT 3 - Wart Closer Probability (Clasificación)")
    print("="*50)
    
    model_wartcloser = CatBoostClassifier(
        iterations=300, learning_rate=0.05, depth=6, eval_metric='Accuracy', random_seed=42, verbose=100
    )
    model_wartcloser.fit(X_train, y_wart_closer_train, cat_features=cat_features, eval_set=(X_test, y_wart_closer_test), use_best_model=True)
    out_wartcloser = MODELS_DIR / "model_wartcloser.cbm"
    model_wartcloser.save_model(str(out_wartcloser))
    
    print("\n[INFO] Entrenamiento finalizado. Todos los modelos han sido compilados y exportados.")

if __name__ == "__main__":
    train_models()
