"""
V2 Script 11 — Optuna Hyperparameter Optimization
===================================================
Bayesian optimization for the V2 cascade models.
Optimizes each phase independently with time-based CV.

Phase 0: Predict match_duration
Phase 1: Predict deposits/kills/wart
Phase 2: Predict is_win

Output:
  - models/v2/striker/optimized_*.cbm
  - models/v2/defender/optimized_*.cbm
  - models/v2/*/best_params.json
  - data/analysis/11_optuna_report.md
"""

import pandas as pd
import numpy as np
import json
import optuna
from math import floor
from pathlib import Path
from sklearn.metrics import mean_absolute_error
from catboost import CatBoostClassifier, CatBoostRegressor

from config import (
    DATA_DIR, V2_MODELS_DIR, CLASSES, TRAIN_CUTOFF, VAL_CUTOFF,
    ensure_dirs, save_report, print_separator
)

optuna.logging.set_verbosity(optuna.logging.WARNING)

STRIKER_INPUT  = DATA_DIR / "striker_matches_v2.csv"
DEFENDER_INPUT = DATA_DIR / "defender_matches_v2.csv"

BASE_CAT_FEATURES = ["champ_class", "enemy_champ_class", "team_comp", "enemy_comp", "matchup_key"]

COMPANION_HIST_FEATURES = [
    "hist_matchup_wr", "hist_pair_wr",
    "hist_wr_with_ally1", "hist_wr_with_ally2",
    "hist_kills_ally1", "hist_kills_ally2",
    "hist_deposits_ally1", "hist_deposits_ally2",
    "hist_wart_ally1", "hist_wart_ally2",
    "hist_role_ally1", "hist_role_ally2",
    "ally1_class", "ally2_class",
]

COMPANION_CAT_NAMES = {"hist_role_ally1", "hist_role_ally2", "ally1_class", "ally2_class"}

def get_count_features():
    cols = []
    for cls in CLASSES:
        cols.append(f"ally_{cls}_count")
        cols.append(f"enemy_ally_{cls}_count")
    return cols

def get_base_features():
    return list(BASE_CAT_FEATURES) + COMPANION_HIST_FEATURES + get_count_features()

def get_cat_indices(feature_cols):
    cat_names = set(BASE_CAT_FEATURES) | COMPANION_CAT_NAMES
    return [i for i, c in enumerate(feature_cols) if c in cat_names]

def time_split(df):
    df = df.copy()
    df["_date"] = pd.to_datetime(df["match_date"]).dt.strftime("%Y-%m-%d")
    train = df[df["_date"] < TRAIN_CUTOFF].drop(columns=["_date"])
    val   = df[(df["_date"] >= TRAIN_CUTOFF) & (df["_date"] < VAL_CUTOFF)].drop(columns=["_date"])
    test  = df[df["_date"] >= VAL_CUTOFF].drop(columns=["_date"])
    return train, val, test

N_TRIALS = 50

def make_regressor_objective(X_train, y_train, X_val, y_val, cat_indices):
    def objective(trial):
        params = {
            "iterations": trial.suggest_int("iterations", 200, 1500),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "depth": trial.suggest_int("depth", 3, 10),
            "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1.0, 10.0),
            "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 1, 100),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bylevel": trial.suggest_float("colsample_bylevel", 0.5, 1.0),
            "eval_metric": "MAE",
            "random_seed": 42,
            "verbose": False,
        }
        model = CatBoostRegressor(**params)
        model.fit(X_train, y_train, cat_features=cat_indices,
                  eval_set=(X_val, y_val), use_best_model=True, early_stopping_rounds=50)
        preds = model.predict(X_val)
        return mean_absolute_error(y_val, preds)
    return objective

def make_classifier_objective(X_train, y_train, X_val, y_val, cat_indices):
    def objective(trial):
        params = {
            "iterations": trial.suggest_int("iterations", 200, 1500),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.2, log=True),
            "depth": trial.suggest_int("depth", 3, 10),
            "l2_leaf_reg": trial.suggest_float("l2_leaf_reg", 1.0, 10.0),
            "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 1, 100),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bylevel": trial.suggest_float("colsample_bylevel", 0.5, 1.0),
            "eval_metric": "Accuracy",
            "random_seed": 42,
            "verbose": False,
        }
        loss_fn = "MultiClass" if y_train.nunique() > 2 else "Logloss"
        if loss_fn == "MultiClass":
            params["bootstrap_type"] = "Bernoulli"
            
        model = CatBoostClassifier(**params, loss_function=loss_fn)
        model.fit(X_train, y_train, cat_features=cat_indices,
                  eval_set=(X_val, y_val), use_best_model=True, early_stopping_rounds=50)
        preds = model.predict(X_val).flatten()
        return (preds == y_val.values).mean()
    return objective

def add_predictions(X, col, values):
    out = X.copy()
    out[col] = values
    return out

def optimize_class(df, class_name):
    print_separator(f"OPTUNA: {class_name.upper()}")
    model_dir = V2_MODELS_DIR / class_name.lower()
    model_dir.mkdir(parents=True, exist_ok=True)
    
    train, val, test = time_split(df)
    base_cols = [c for c in get_base_features() if c in df.columns]
    cat_idx0 = get_cat_indices(base_cols)
    
    X0_tr = train[base_cols].fillna("").astype(str)
    X0_va = val[base_cols].fillna("").astype(str)
    X0_te = test[base_cols].fillna("").astype(str)
    
    all_results = {}
    best_params_all = {}
    
    # ── Phase 0: Duration ──
    print(f"\n[OPTUNA] Optimizing Phase 0 (Duration) ({N_TRIALS} trials)...")
    y_dur_tr = train["match_duration"].astype(float)
    y_dur_va = val["match_duration"].astype(float)
    y_dur_te = test["match_duration"].astype(float)
    
    study_dur = optuna.create_study(direction="minimize")
    study_dur.optimize(make_regressor_objective(X0_tr, y_dur_tr, X0_va, y_dur_va, cat_idx0),
                       n_trials=N_TRIALS, show_progress_bar=True)
    best_dur = study_dur.best_params
    best_dur["eval_metric"] = "MAE"; best_dur["random_seed"] = 42; best_dur["verbose"] = False
    best_params_all["duration"] = best_dur
    
    m_dur = CatBoostRegressor(**best_dur)
    m_dur.fit(X0_tr, y_dur_tr, cat_features=cat_idx0, eval_set=(X0_va, y_dur_va), use_best_model=True)
    m_dur.save_model(str(model_dir / "optimized_duration.cbm"))
    
    p_dur_tr = np.maximum(0, m_dur.predict(X0_tr))
    p_dur_va = np.maximum(0, m_dur.predict(X0_va))
    p_dur_te = np.maximum(0, m_dur.predict(X0_te))
    all_results["dur_mae_val"] = mean_absolute_error(y_dur_va, p_dur_va)
    all_results["dur_mae_test"] = mean_absolute_error(y_dur_te, p_dur_te)
    
    p1_cols = base_cols + ["pred_duration"]
    cat_idx1 = get_cat_indices(p1_cols)
    X1_tr = add_predictions(X0_tr, "pred_duration", p_dur_tr)
    X1_va = add_predictions(X0_va, "pred_duration", p_dur_va)
    X1_te = add_predictions(X0_te, "pred_duration", p_dur_te)

    if class_name == "Striker":
        # ── Phase 1: Deposits ──
        print(f"\n[OPTUNA] Optimizing Phase 1 (Deposits) ({N_TRIALS} trials)...")
        y_dep_tr = train["res_deposits"].astype(float)
        y_dep_va = val["res_deposits"].astype(float)
        y_dep_te = test["res_deposits"].astype(float)
        
        study_dep = optuna.create_study(direction="minimize")
        study_dep.optimize(make_regressor_objective(X1_tr, y_dep_tr, X1_va, y_dep_va, cat_idx1),
                           n_trials=N_TRIALS, show_progress_bar=True)
        best_dep = study_dep.best_params
        best_dep["eval_metric"] = "MAE"; best_dep["random_seed"] = 42; best_dep["verbose"] = False
        best_params_all["deposits"] = best_dep
        
        m_dep = CatBoostRegressor(**best_dep)
        m_dep.fit(X1_tr, y_dep_tr, cat_features=cat_idx1, eval_set=(X1_va, y_dep_va), use_best_model=True)
        m_dep.save_model(str(model_dir / "optimized_deposits.cbm"))
        
        p_dep_tr = np.maximum(0, m_dep.predict(X1_tr))
        p_dep_va = np.maximum(0, m_dep.predict(X1_va))
        p_dep_te = np.maximum(0, m_dep.predict(X1_te))
        all_results["dep_mae_test"] = mean_absolute_error(y_dep_te, p_dep_te)
        
        # ── Phase 2: Win ──
        print(f"\n[OPTUNA] Optimizing Phase 2 (Win Rate) ({N_TRIALS} trials)...")
        p2_cols = p1_cols + ["pred_deposits"]
        cat_idx2 = get_cat_indices(p2_cols)
        X2_tr = add_predictions(X1_tr, "pred_deposits", p_dep_tr)
        X2_va = add_predictions(X1_va, "pred_deposits", p_dep_va)
        X2_te = add_predictions(X1_te, "pred_deposits", p_dep_te)
        
        y_win_tr = train["is_win"].astype(int)
        y_win_va = val["is_win"].astype(int)
        y_win_te = test["is_win"].astype(int)
        
        study_win = optuna.create_study(direction="maximize")
        study_win.optimize(make_classifier_objective(X2_tr, y_win_tr, X2_va, y_win_va, cat_idx2),
                           n_trials=N_TRIALS, show_progress_bar=True)
        best_win = study_win.best_params
        best_win["eval_metric"] = "Accuracy"; best_win["random_seed"] = 42; best_win["verbose"] = False
        best_params_all["winrate"] = best_win
        
        m_win = CatBoostClassifier(**best_win)
        m_win.fit(X2_tr, y_win_tr, cat_features=cat_idx2, eval_set=(X2_va, y_win_va), use_best_model=True)
        m_win.save_model(str(model_dir / "optimized_winrate.cbm"))
        
        p_wr_te = m_win.predict_proba(X2_te)[:, 1]
        all_results["wr_acc_test"] = (m_win.predict(X2_te) == y_win_te.values).mean()
        
        comp_te = p_wr_te * 200 + p_dep_te * 50
        all_results["score_mae_test"] = mean_absolute_error(test["striker_score"].values, comp_te)
        
        
    elif class_name == "Defender":
        # ── Phase 1a: Kills ──
        print(f"\n[OPTUNA] Optimizing Phase 1a (Kills) ({N_TRIALS} trials)...")
        y_ki_tr = train["res_eliminations"].astype(float)
        y_ki_va = val["res_eliminations"].astype(float)
        y_ki_te = test["res_eliminations"].astype(float)
        
        study_ki = optuna.create_study(direction="minimize")
        study_ki.optimize(make_regressor_objective(X1_tr, y_ki_tr, X1_va, y_ki_va, cat_idx1),
                          n_trials=N_TRIALS, show_progress_bar=True)
        best_ki = study_ki.best_params
        best_ki["eval_metric"] = "MAE"; best_ki["random_seed"] = 42; best_ki["verbose"] = False
        best_params_all["kills"] = best_ki
        
        m_ki = CatBoostRegressor(**best_ki)
        m_ki.fit(X1_tr, y_ki_tr, cat_features=cat_idx1, eval_set=(X1_va, y_ki_va), use_best_model=True)
        m_ki.save_model(str(model_dir / "optimized_kills.cbm"))
        
        p_ki_tr = np.maximum(0, m_ki.predict(X1_tr))
        p_ki_va = np.maximum(0, m_ki.predict(X1_va))
        p_ki_te = np.maximum(0, m_ki.predict(X1_te))
        all_results["kills_mae_test"] = mean_absolute_error(y_ki_te, p_ki_te)
        
        # ── Phase 1b: Wart ──
        print(f"\n[OPTUNA] Optimizing Phase 1b (Wart) ({N_TRIALS} trials)...")
        y_wa_tr = train["res_wart_distance"].astype(float)
        y_wa_va = val["res_wart_distance"].astype(float)
        y_wa_te = test["res_wart_distance"].astype(float)
        
        study_wa = optuna.create_study(direction="minimize")
        study_wa.optimize(make_regressor_objective(X1_tr, y_wa_tr, X1_va, y_wa_va, cat_idx1),
                          n_trials=N_TRIALS, show_progress_bar=True)
        best_wa = study_wa.best_params
        best_wa["eval_metric"] = "MAE"; best_wa["random_seed"] = 42; best_wa["verbose"] = False
        best_params_all["wart"] = best_wa
        
        m_wa = CatBoostRegressor(**best_wa)
        m_wa.fit(X1_tr, y_wa_tr, cat_features=cat_idx1, eval_set=(X1_va, y_wa_va), use_best_model=True)
        m_wa.save_model(str(model_dir / "optimized_wart.cbm"))
        
        p_wa_tr = np.maximum(0, m_wa.predict(X1_tr))
        p_wa_va = np.maximum(0, m_wa.predict(X1_va))
        p_wa_te = np.maximum(0, m_wa.predict(X1_te))
        all_results["wart_mae_test"] = mean_absolute_error(y_wa_te, p_wa_te)
        
        # ── Phase 2: Win ──
        print(f"\n[OPTUNA] Optimizing Phase 2 (Win Rate) ({N_TRIALS} trials)...")
        p2_cols = p1_cols + ["pred_kills", "pred_wart"]
        cat_idx2 = get_cat_indices(p2_cols)
        X2_tr = add_predictions(add_predictions(X1_tr, "pred_kills", p_ki_tr), "pred_wart", p_wa_tr)
        X2_va = add_predictions(add_predictions(X1_va, "pred_kills", p_ki_va), "pred_wart", p_wa_va)
        X2_te = add_predictions(add_predictions(X1_te, "pred_kills", p_ki_te), "pred_wart", p_wa_te)
        
        y_win_tr = train["is_win"].astype(int)
        y_win_va = val["is_win"].astype(int)
        y_win_te = test["is_win"].astype(int)
        
        study_win = optuna.create_study(direction="maximize")
        study_win.optimize(make_classifier_objective(X2_tr, y_win_tr, X2_va, y_win_va, cat_idx2),
                           n_trials=N_TRIALS, show_progress_bar=True)
        best_win = study_win.best_params
        best_win["eval_metric"] = "Accuracy"; best_win["random_seed"] = 42; best_win["verbose"] = False
        best_params_all["winrate"] = best_win
        
        m_win = CatBoostClassifier(**best_win)
        m_win.fit(X2_tr, y_win_tr, cat_features=cat_idx2, eval_set=(X2_va, y_win_va), use_best_model=True)
        m_win.save_model(str(model_dir / "optimized_winrate.cbm"))
        
        p_wr_te = m_win.predict_proba(X2_te)[:, 1]
        all_results["wr_acc_test"] = (m_win.predict(X2_te) == y_win_te.values).mean()
        
        comp_te = p_wr_te * 200 + p_ki_te * 80 + np.floor(p_wa_te / 80) * 40
        all_results["score_mae_test"] = mean_absolute_error(test["defender_score"].values, comp_te)
        
        
    print(f"\n[OK] Completed optimization for {class_name}")
    with open(model_dir / "best_params.json", "w") as f:
        json.dump(best_params_all, f, indent=2)
    
    all_results["best_params"] = best_params_all
    return all_results

def main():
    ensure_dirs()
    (V2_MODELS_DIR / "striker").mkdir(parents=True, exist_ok=True)
    (V2_MODELS_DIR / "defender").mkdir(parents=True, exist_ok=True)
    
    df_striker = pd.read_csv(STRIKER_INPUT, low_memory=False)
    df_defender = pd.read_csv(DEFENDER_INPUT, low_memory=False)
    
    striker_res = optimize_class(df_striker, "Striker")
    defender_res = optimize_class(df_defender, "Defender")
    
    print_separator("GENERATING OPTUNA REPORT")
    report = "# Optuna Optimization Report (Phase 0/1/2)\n\n"
    report += f"**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
    
    report += "\n## Striker\n"
    report += f"- Duration MAE: {striker_res['dur_mae_test']:.1f}s\n"
    report += f"- Deposits MAE: {striker_res['dep_mae_test']:.3f}\n"
    report += f"- Win Rate Acc: {striker_res['wr_acc_test']:.3f}\n"
    report += f"- **Composite MAE**: {striker_res['score_mae_test']:.1f}\n"
    
    report += "\n## Defender\n"
    report += f"- Duration MAE: {defender_res['dur_mae_test']:.1f}s\n"
    report += f"- Kills MAE: {defender_res['kills_mae_test']:.3f}\n"
    report += f"- Wart MAE: {defender_res['wart_mae_test']:.1f}\n"
    report += f"- Win Rate Acc: {defender_res['wr_acc_test']:.3f}\n"
    report += f"- **Composite MAE**: {defender_res['score_mae_test']:.1f}\n"
    
    save_report("11_optuna_report.md", report)
    print("\n[DONE] Optuna optimization complete.")

if __name__ == "__main__":
    main()
