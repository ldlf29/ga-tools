# Grand Arena Tools: ML Pipeline Evolution (V1 → V2 → V3)
**Date:** May 4, 2026
**Scope:** Audit of data sources, feature engineering, and model architecture across pipeline versions.

---

## Executive Summary
The Grand Arena Machine Learning pipeline has evolved through three distinct phases to improve predictive accuracy and generalization. 
- **V1** established the baseline using raw game context and individual stats.
- **V2** introduced specialization (Striker vs. Defender) and companion history, but suffered from data leakage.
- **V3** is the definitive "Cascade" architecture. It combines the clean baseline of V1 with the mathematical rigor of V2, deliberately dropping the biased historical features to predict entirely novel matchups.

---

## V1: Global Baseline Models
**Core Philosophy:** Predict individual outcomes based on raw game context and basic composition.
**Scripts:** `ml/2_preprocess.py`, `ml/3_prepare_features.py`, `ml/4_train_models.py`

### 📥 From Where?
- `raw_matches.csv` (1 row per Moki, generated from Supabase `moki_match_history`).
- Supabase `moki_stats` (to append static Moki base stats like Dexterity, Strength).

### ✅ What We Use
- **Match Context:** `match_duration`, `win_condition`, `match_game_type`.
- **Basic Composition:** `champ_class`, `enemy_champ_class`, `team_comp`, `enemy_comp`.
- **Individual Base Stats:** `total_stats`, `defense`, `dexterity`, `fortitude`, `speed`, `strength`.
- **Targets (for training only):** `is_win`, `res_deposits`, `res_eliminations`, `res_wart_distance`, `total_points`, etc.

### ❌ What We Eliminate
- **Raw Player IDs:** Dropped `p1_moki_id`, `p2_moki_id`, etc., to prevent the model from memorizing specific Moki IDs instead of learning patterns.
- **Leaky Post-Match Data as Inputs:** Removed targets from the input feature set to ensure predictions are made strictly on pre-match data.

---

## V2: Specialized Role Models
**Core Philosophy:** Different roles play different games. A Striker's success is measured in deposits; a Defender's in kills and wart distance.
**Scripts:** `ml/specialized/2_extract_class_data.py`, `ml/specialized/4_retrain_v2_models.py`

### 📥 From Where?
- `raw_specialized.csv` (1 row per match with all 6 players' detailed stats).
- Supabase `moki_stats` snapshot.

### ✅ What We Use (Introduced)
- **Role Splitting:** Filtered datasets into `striker_matches.csv` and `defender_matches.csv`.
- **Mathematical Deltas:** `stats_delta`, `delta_defense`, `delta_dexterity`, etc. (Champion stat minus Enemy Champion stat).
- **Class Counts:** Features like `ally_Bruiser_count` to understand team density.
- **Companion History (`hist_*`):** Features like `hist_matchup_wr`, `hist_pair_wr`, `hist_wr_with_ally1/2`, computed from real match data and stored in the `_v2.csv` files via lookup JSONs.

### ❌ What We Eliminate
- **Post-match ally stats as inputs:** `ally1_eliminations`, `ally1_deposits`, etc. are post-match and should only be targets.

---

## V3: The Cascade Architecture (Definitive)
**Core Philosophy:** Predict auxiliary metrics first (Fase 1), use those to predict the Win Rate (Fase 2), and use both to predict Total Points (Fase 3).
**Scripts:** `ml/v3/1_prepare_v3_data.py`, `ml/v3/2_train_v3_models.py`

### 📥 From Where?
- Merges `processed_matches.csv` (V1 baseline) with `striker/defender_matches.csv` (V2 specialized data) using an Inner Join on `match_id` and `moki_token_id`.

### ✅ What We Re-Use (The Synthesis)
- **From V1:** The clean Match Context (`match_game_type`) and the rigorous separation of pre-match inputs vs. post-match targets.
- **From V2:** The Mathematical Deltas (`delta_speed`, `delta_strength`), the Class Counts, **and** the Companion History (`hist_matchup_wr`, `hist_pair_wr`, etc.) — these are real data from `_v2.csv`, not invented.
- **Individual Champ Stats:** `champ_defense`, `champ_dexterity`, `champ_fortitude`, `champ_speed`, `champ_strength` from V2.

### ❌ What We Eliminate
- **Post-match ally performance stats:** `ally1_deposits`, `ally2_kills`, etc. — these are post-match data that would leak the outcome.
- **Single-Step Prediction:** We no longer try to guess `total_points` directly from the raw inputs.

### 🔄 How We Use It (The Cascade)
1. **Inputs:** `BASE_CAT` (classes, comps) + `CHAMP_STAT_FEATURES` (individual stats + deltas) + `COMPANION_FEATURES` (hist_*) + `MATCH_CONTEXT_FEATURES` + Class Counts.
2. **Phase 1 (Auxiliary):** Train models for `duration`, `deposits`, `kills`, `deaths`, `wart_dist`, `wart_closer`.
3. **Phase 2 (Win Rate):** Inputs + Phase 1 Predictions → Predict `is_win`.
4. **Phase 3 (Points):** Inputs + Phase 1 Predictions + Phase 2 Prediction → Predict `total_points` and `win_condition`.

---

## Feature Evolution Matrix

| Feature Category | V1 (Global) | V2 (Specialized) | V3 (Cascade) | Rationale for V3 |
| :--- | :---: | :---: | :---: | :--- |
| **Moki IDs / Names** | ❌ Dropped | ❌ Dropped | ❌ Dropped | Prevents memorization. |
| **Basic Classes & Comps** | ✅ Used | ✅ Used | ✅ Used | Foundational context. |
| **Base Static Stats** | ✅ Used | ✅ Used | ✅ Used (individual) | V3 adds individual stats (def/dex/fort/spd/str). |
| **Mathematical Deltas** | ❌ Not Present | ✅ Introduced | ✅ Retained | Explains mechanical advantages generalized across all Mokis. |
| **Companion History** | ❌ Not Present | ✅ Introduced | ✅ Retained | Real data from `_v2.csv` via lookup JSONs. Historical context about ally performance. |
| **Cascade Predictions** | ❌ Direct | ❌ Direct | ✅ Core Logic | Simulates the flow of a game (Stats -> Actions -> Win -> Points). |
