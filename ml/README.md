# Grand Arena — ML Pipeline

Pipeline de Data Science para análisis predictivo de Grand Arena.

## Estructura

```
ml/
├── 1_collect_data.py    # Descarga performances de la API (requiere Bearer Token)
├── 2_preprocess.py      # Feature engineering y limpieza
├── 3_train.py           # Entrenamiento CatBoost (clasificador + regresor)
├── 4_analyze.py         # Análisis, SHAP values y simulación de matchups
├── data/
│   ├── raw_matches.csv          # Salida del script 1
│   ├── processed_matches.csv    # Salida del script 2
│   ├── empirical_winrates.csv   # Salida del script 4
│   └── model_metrics.json       # Métricas de evaluación (script 3)
└── models/
    ├── catboost_classifier.cbm  # Modelo WinRate
    └── catboost_regressor.cbm   # Modelo Expected Points
```

## Instalación de dependencias

```bash
pip install catboost scikit-learn pandas numpy shap requests
```

## Ejecución paso a paso

### Paso 1 — Recolectar datos
Necesitás un **Bearer Token** de la API de Grand Arena.

```bash
python 1_collect_data.py --token TU_TOKEN_AQUI
```

Esto itera sobre los **180 mokis** del `mokiMetadata.json`, descarga todos sus
performances y filtra hasta el **2026-02-20** inclusive. Puede tardar varios
minutos (rate-limiting incluido).

### Paso 2 — Preprocesar
```bash
python 2_preprocess.py
```

Transforma `raw_matches.csv` en `processed_matches.csv` con:
- Aliados ordenados alfabéticamente (invarianza de orden)
- Feature crosses: `team_comp` y `enemy_comp`
- Tipos correctos para CatBoost

### Paso 3 — Entrenar modelos
```bash
python 3_train.py
```

Entrena:
- **CatBoostClassifier** → predice `is_win` (WinRate)
- **CatBoostRegressor** → predice `total_points` (Expected Points)

Split 80/20 estratificado. Los modelos se guardan en `models/`.

### Paso 4 — Analizar y simular

#### Análisis general
```bash
python 4_analyze.py
```
Muestra:
- Top 20 composiciones por WinRate empírico
- Feature Importance de ambos modelos
- SHAP values del clasificador

#### Simular un matchup específico
```bash
python 4_analyze.py --simulate "STRIKER_DEFENDER_GACHA" "RUNNER_HEALER_STRIKER"
```

Formato de composición: `CHAMP_ALLY1_ALLY2` (en mayúsculas, separado por `_`)

#### Simular mi comp contra todas las enemigas del dataset
```bash
python 4_analyze.py --vs-all "STRIKER_DEFENDER_GACHA"
```

## Notas sobre la API

- Endpoint: `GET /api/v1/mokis/{tokenId}/performances?page=1&limit=100`
- Autenticación: `Authorization: Bearer <token>`
- El script maneja paginación automáticamente
- Se incluye rate-limiting (0.5s entre requests) para evitar bloqueos

## Arquitectura del modelo

```
Features:
    team_comp       ← cruce (champ + ally1 + ally2)
    enemy_comp      ← cruce (enemy_champ + enemy_ally1 + enemy_ally2)
    champ_class
    ally1_class, ally2_class
    enemy_champ_class
    enemy_ally1_class, enemy_ally2_class
    win_condition

Targets:
    is_win          → CatBoostClassifier (Logloss + AUC)
    total_points    → CatBoostRegressor  (RMSE + MAE)
```

CatBoost fue elegido sobre XGBoost porque maneja features categóricas
**nativas** sin necesidad de One-Hot Encoding, lo cual es ideal dado que
todos nuestros features son strings de clases.
