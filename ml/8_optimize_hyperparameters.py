"""
Script 11 - Hyperparameter Optimization with Optuna
===================================================
Optimizes CatBoost parameters for Score and WinRate models using Bayesian Search.
Uses a time-based split for validation.
"""

import pandas as pd
import numpy as np
import optuna
import catboost as cb
import json
from pathlib import Path
from datetime import datetime
from sklearn.metrics import mean_absolute_error, accuracy_score

# ─── Config ──────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "data"
INPUT_PATH  = DATA_DIR / "ml_features.csv"

def objective_score(trial):
    # Load and prepare data
    df = pd.read_csv(INPUT_PATH)
    df["match_date"] = pd.to_datetime(df["match_date"])
    
    # Time-based split (Last 20% matches for validation)
    df = df.sort_values("match_date")
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]
    
    target_cols = ["is_win", "total_points", "win_condition", "res_deaths", "res_deposits", "res_wart_closer", "match_date"]
    feature_cols = [c for c in df.columns if c not in target_cols]
    cat_features = ["moki_token_id", "enemy_champ_token_id", "moki_vs_enemy", "champ_class", "enemy_champ_class"]
    
    X_train = train_df[feature_cols].astype(str)
    y_train = train_df["total_points"].astype(float)
    X_test = test_df[feature_cols].astype(str)
    y_test = test_df["total_points"].astype(float)
    
    params = {
        "iterations": 1000,
        "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
        "depth": trial.suggest_int("depth", 4, 10),
        "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1, 10),
        "random_strength": trial.suggest_float("random_strength", 1e-9, 10, log=True),
        "bagging_temperature": trial.suggest_float("bagging_temperature", 0, 1),
        "border_count": trial.suggest_int("border_count", 32, 255),
        "loss_function": "RMSE",
        "eval_metric": "MAE",
        "random_seed": 42,
        "verbose": False
    }
    
    model = cb.CatBoostRegressor(**params)
    model.fit(X_train, y_train, cat_features=cat_features, eval_set=(X_test, y_test), early_stopping_rounds=50)
    
    preds = model.predict(X_test)
    return mean_absolute_error(y_test, preds)

def objective_winrate(trial):
    df = pd.read_csv(INPUT_PATH)
    df["match_date"] = pd.to_datetime(df["match_date"])
    df = df.sort_values("match_date")
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]
    
    target_cols = ["is_win", "total_points", "win_condition", "res_deaths", "res_deposits", "res_wart_closer", "match_date"]
    feature_cols = [c for c in df.columns if c not in target_cols]
    cat_features = ["moki_token_id", "enemy_champ_token_id", "moki_vs_enemy", "champ_class", "enemy_champ_class"]
    
    X_train = train_df[feature_cols].astype(str)
    y_train = train_df["is_win"].astype(int)
    X_test = test_df[feature_cols].astype(str)
    y_test = test_df["is_win"].astype(int)
    
    params = {
        "iterations": 1000,
        "learning_rate": trial.suggest_float("learning_rate", 1e-3, 0.3, log=True),
        "depth": trial.suggest_int("depth", 4, 10),
        "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1, 10),
        "random_strength": trial.suggest_float("random_strength", 1e-9, 10, log=True),
        "bagging_temperature": trial.suggest_float("bagging_temperature", 0, 1),
        "loss_function": "Logloss",
        "eval_metric": "Accuracy",
        "random_seed": 42,
        "verbose": False
    }
    
    model = cb.CatBoostClassifier(**params)
    model.fit(X_train, y_train, cat_features=cat_features, eval_set=(X_test, y_test), early_stopping_rounds=50)
    
    preds = model.predict(X_test)
    return accuracy_score(y_test, preds)

def run_study(name, obj_func, direction="minimize"):
    print(f"\n[INFO] Optimizing {name}...")
    study = optuna.create_study(direction=direction)
    study.optimize(obj_func, n_trials=20)
    
    print(f"Best Value for {name}: {study.best_value:.4f}")
    
    out_path = DATA_DIR / f"best_params_{name.lower().replace(' ', '_')}.json"
    with open(out_path, "w") as f:
        json.dump(study.best_params, f, indent=2)
    print(f"[OK] Params saved to {out_path}")

def main():
    run_study("Score Model", objective_score, "minimize")
    run_study("WinRate Model", objective_winrate, "maximize")

if __name__ == "__main__":
    main()
