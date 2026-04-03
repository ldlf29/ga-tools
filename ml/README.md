# Grand Arena — ML Pipeline

Data Science pipeline for predictive analysis of Grand Arena matches.

## Structure

```
ml/
├── 1_collect_data.py      # Initial data collection from GA API
├── _2_preprocess.py       # Cleans raw data and derives features (Team Comps, etc.)
├── _5_prepare_features.py  # Generates numerical matrices for CatBoost
├── _6_train_models.py     # Trains Cascade Stacking models (Score, WinRate, Deaths, etc.)
├── 7_api_server.py        # FastAPI inference server (Cascade Architecture)
├── 8_generate_rank.py     # Generates ranking for 180 Moki Champions
├── 9_evaluate_results.py  # Validation & Backtesting (MAE/Accuracy)
├── 10_retrain_from_supabase.py # Automated Feedback Loop & Incremental Learning
├── 11_optimize_hyperparameters.py # Bayesian Tuning with Optuna
├── data/                  # Raw and processed datasets
└── models/                # Exported CatBoost models (.cbm)
```

## Advanced Architecture: Cascade Stacking

To maximize accuracy, we use a two-phase prediction system:

1.  **Auxiliary Models**: Predict specific game metrics (`Deaths`, `Deposits`, `WartCloser`).
2.  **Primary Models**: The `Score` and `WinRate` models use the outputs of the auxiliary models as additional numerical features (Stacking).

## Key Features
- **Identity-Based Learning**: Models learn individual Moki performance patterns using `Moki ID`.
- **Matchup Interactions**: Explicit interaction feature `moki_vs_enemy` to capture specific counters.
- **Time Weighting**: Recent matches have higher importance (2.0x weight for last 7 days).
- **Automated Feedback Loop**: Script 10 allows the models to learn from the results of the matches they previously predicted.

## Automation
The pipeline is integrated with the webapp's cron system. When upcoming matches are synced, the model automatically retrains itself with the latest historical data from Supabase before generating new rankings.

## Requirements
- Python 3.10+
- `pip install -r requirements.txt` (includes catboost, optuna, pandas, scikit-learn, etc.)
