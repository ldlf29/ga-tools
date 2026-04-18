"""
Script 11 - Hyperparameter Optimization with Optuna
===================================================
Optimizes CatBoost parameters for Phase 1 (Auxiliary) and Phase 2 (Main) models
using Bayesian Search. Uses a time-based split for validation.
"""

import pandas as pd
import numpy as np
import optuna
import catboost as cb
import json
from pathlib import Path
from sklearn.metrics import mean_absolute_error, accuracy_score
import argparse

# ─── Config ──────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "data"
INPUT_PATH  = DATA_DIR / "ml_features.csv"

def prepare_data(target_col, is_classifier=False):
    df = pd.read_csv(INPUT_PATH)
    df["match_date"] = pd.to_datetime(df["match_date"])
    
    # Drop rows where target is NaN
    if target_col in df.columns:
        df = df.dropna(subset=[target_col])
    else:
        raise ValueError(f"Target column {target_col} not found in data.")

    df = df.sort_values("match_date")
    split_idx = int(len(df) * 0.8)
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]
    
    target_cols = [
        "is_win", "total_points", "win_condition", 
        "res_deaths", "res_eliminations", "res_deposits", 
        "res_wart_closer", "res_wart_distance", "match_date",
        "res_wart_ride_seconds", "res_buff_time_seconds", 
        "res_eaten_by_wart", "res_loose_ball_pickups", 
        "res_eating_while_riding"
    ]
    
    feature_cols = [c for c in df.columns if c not in target_cols]
    cat_features = ["champ_class", "enemy_champ_class", "team_comp", "enemy_comp"]
    
    X_train = train_df[feature_cols].astype(str)
    y_train = train_df[target_col].astype(int if is_classifier else float)
    
    X_test = test_df[feature_cols].astype(str)
    y_test = test_df[target_col].astype(int if is_classifier else float)
    
    return X_train, y_train, X_test, y_test, cat_features

def objective_regressor(trial, target_col):
    X_train, y_train, X_test, y_test, cat_features = prepare_data(target_col, is_classifier=False)
    
    params = {
        "iterations": trial.suggest_int("iterations", 500, 1500, step=100),
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

def objective_classifier(trial, target_col):
    X_train, y_train, X_test, y_test, cat_features = prepare_data(target_col, is_classifier=True)
    
    params = {
        "iterations": trial.suggest_int("iterations", 500, 1500, step=100),
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

def run_study(name, target_col, is_classifier=False, n_trials=20):
    print(f"\n[INFO] Optimizing {name} (Target: {target_col})...")
    direction = "maximize" if is_classifier else "minimize"
    study = optuna.create_study(direction=direction)
    
    if is_classifier:
        study.optimize(lambda trial: objective_classifier(trial, target_col), n_trials=n_trials)
    else:
        study.optimize(lambda trial: objective_regressor(trial, target_col), n_trials=n_trials)
    
    print(f"Best Value for {name}: {study.best_value:.4f}")
    
    out_path = DATA_DIR / f"best_params_{name.lower().replace(' ', '_')}.json"
    with open(out_path, "w") as f:
        json.dump(study.best_params, f, indent=2)
    print(f"[OK] Params saved to {out_path}")

def main():
    parser = argparse.ArgumentParser(description="Hyperparameter Optimizer")
    parser.add_argument("--phase", choices=["all", "phase1", "phase2"], default="phase2", help="Which models to optimize")
    parser.add_argument("--trials", type=int, default=20, help="Number of optuna trials per model")
    parser.add_argument("--models", type=str, default="", help="Comma-separated list of specific models to run (e.g., 'WartDistance,WartCloser')")
    args = parser.parse_args()

    phase1_models = [
        {"name": "Deaths", "target": "res_deaths", "is_classifier": False},
        {"name": "Kills", "target": "res_eliminations", "is_classifier": False},
        {"name": "Deposits", "target": "res_deposits", "is_classifier": False},
        {"name": "WartDistance", "target": "res_wart_distance", "is_classifier": False},
        {"name": "WartCloser", "target": "res_wart_closer", "is_classifier": True},
    ]

    phase2_models = [
        {"name": "Score Model", "target": "total_points", "is_classifier": False},
        {"name": "WinRate Model", "target": "is_win", "is_classifier": True},
    ]

    models_to_run = []
    if args.phase in ["all", "phase1"]:
        models_to_run.extend(phase1_models)
    if args.phase in ["all", "phase2"]:
        models_to_run.extend(phase2_models)

    if args.models:
        specific_models = [m.strip().lower() for m in args.models.split(",")]
        models_to_run = [m for m in phase1_models + phase2_models if m["name"].lower() in specific_models]

    for cfg in models_to_run:
        run_study(cfg["name"], cfg["target"], cfg["is_classifier"], args.trials)

if __name__ == "__main__":
    main()
