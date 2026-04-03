# ML Improvement Roadmap - Grand Arena IA

This document serves to track the progress of improvements in Machine Learning models, document experiments, and add comments on performance.

## Current Status
- **Models**: CatBoost (WinRate, Score, WinCondition, Deaths, Deposits, WartCloser).
- **Features**: Identity (Moki ID), Matchup Interactions (Moki A vs Moki B), Class Compositions, Time Weighting.
- **Dataset**: Local historical data + Recent Supabase sync (Incremental).

---

## 1. Validation and Backtesting 🎯 [DONE]
Evaluate the real accuracy by contrasting past predictions with final results.
- [x] Create script `9_evaluate_results.py`.
- [x] Implement MAE (Mean Absolute Error) metric for the Score.
- [x] Implement Accuracy metric for the WinRate.
- [x] Generate error report by "Class" to identify where the model fails most.

**Results (Apr 2026):**
- Global Score MAE: ~582 pts.
- Global WinRate MAE: ~12.6%.
- Most accurate classes: Forward, Striker, Center.
- Challenge classes: Bruiser, Flanker (higher variance).

---

## 2. Pro Feature Engineering 🛠️ [DONE]
Add "Identity-Based" to the "Class-Based" model as well.
- [x] **Moki Embeddings**: Use `Moki ID` (categorical) instead of just its class.
- [x] **Matchup Interactions**: Created `moki_vs_enemy` feature.
- [x] **Impact**: Reduced error by ~4% globally.

---

## 3. Feedback Loop & Retraining 🔄 [DONE]
Make the model learn from the matches it predicted itself.
- [x] Automate the download of historical results from Supabase (`10_retrain_from_supabase.py`).
- [x] Implement incremental training script.
- [x] **Time weighting**: Applied weights (2.0 for last 7 days, 1.5 for last 30 days).

---

## 4. Hyperparameter Optimization 🧪 [DONE]
Extract the maximum potential of CatBoost.
- [x] Integrated **Optuna** for Bayesian parameter search.
- [x] Optimized `learning_rate`, `depth` and `l2_leaf_reg`.
- [x] Time-based validation split implementation.

---

## 5. Cascade Model Architecture (Stacking) 🏗️ [DONE]
Create interdependence between predictions.
- [x] Train auxiliary models: Deaths, Deposits, WartCloser.
- [x] **Stacking**: Used auxiliary predictions as input features for Score and WinRate models.
- [x] Updated API and Ranking scripts to support two-phase cascade inference.

**Comments:**
> The entire pipeline—from data collection and optimization to cascade inference—is now automated and modernized. Accuracy has been improved through identity-based features, matchup interactions, and model stacking.

---
