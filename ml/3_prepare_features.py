"""
Script 3 — Preparación de Features para CatBoost
================================================
Lee `processed_matches.csv` y genera el dataset final `ml_features.csv`.

Features (X):
  - champ_class, enemy_champ_class, team_comp, enemy_comp (categóricas)
  - ally_*_count (x10): cuántos aliados de cada clase
  - enemy_ally_*_count (x10): cuántos enemigos aliados de cada clase

Targets (y) — uno por cada modelo de la cascada:
  - is_win, total_points, win_condition   → modelos principales
  - res_deaths, res_eliminations          → auxiliares Fase 1
  - res_deposits, res_wart_closer         → auxiliares Fase 1
  - res_wart_distance                     → nuevo modelo Fase 1 (wart distance esperada)
  - res_wart_ride_seconds                 → Scheme: Wart Rodeo (+3.5 pts/seg)
  - res_buff_time_seconds                 → Scheme: Flexing (+3.5 pts/seg)
  - res_eaten_by_wart                     → Scheme: Saccing (+100 pts/vez)
  - res_loose_ball_pickups                → Scheme: Litter Collection (+75 pts/bola)
  - res_eating_while_riding               → Scheme: Cursed Dinner (+75 pts/vez)

Sin IDs individuales de Moki — el modelo generaliza por clase,
no por identidad de cada NFT.
"""

import pandas as pd
from pathlib import Path

# ─── Rutas ───────────────────────────────────────────────────────────────────
DATA_DIR    = Path(__file__).parent / "data"
INPUT_PATH  = DATA_DIR / "processed_matches.csv"
OUTPUT_PATH = DATA_DIR / "ml_features.csv"

CLASSES = [
    "Anchor", "Bruiser", "Center", "Defender", "Flanker",
    "Forward", "Grinder", "Sprinter", "Striker", "Support"
]

def prepare_features():
    print(f"[INFO] Leyendo {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH, low_memory=False)
    print(f"[INFO] Shape inicial: {df.shape}")

    print("[INFO] Generando conteos de clases por aliado y enemigo...")

    # Inicializar todos a 0
    for cls in CLASSES:
        df[f"ally_{cls}_count"] = 0
        df[f"enemy_ally_{cls}_count"] = 0

    def count_classes(col1, col2, target):
        return (col1 == target).astype(int) + (col2 == target).astype(int)

    for cls in CLASSES:
        df[f"ally_{cls}_count"]       = count_classes(df["ally1_class"], df["ally2_class"], cls)
        df[f"enemy_ally_{cls}_count"] = count_classes(df["enemy_ally1_class"], df["enemy_ally2_class"], cls)

    print("[INFO] Features generadas exitosamente.")

    # Variables de clase puras (sin IDs individuales)
    class_cols = ["champ_class", "enemy_champ_class", "team_comp", "enemy_comp"]
    ally_cols  = [f"ally_{cls}_count" for cls in CLASSES]
    enemy_cols = [f"enemy_ally_{cls}_count" for cls in CLASSES]

    target_cols = [
        # ── Targets principales ──────────────────────────────────────────────
        "is_win", "total_points", "win_condition",
        # ── Auxiliares Fase 1 (stacking) ─────────────────────────────────────
        "res_deaths", "res_eliminations", "res_deposits", "res_wart_closer",
        # ── Nuevo modelo: wart distance esperada ──────────────────────────────
        "res_wart_distance",
        # ── Stats para simulación de Schemes de rendimiento ──────────────────
        "res_wart_ride_seconds",      # Scheme: Wart Rodeo (+3.5 pts/seg)
        "res_buff_time_seconds",      # Scheme: Flexing (+3.5 pts/seg)
        "res_eaten_by_wart",          # Scheme: Saccing (+100 pts/vez)
        "res_loose_ball_pickups",     # Scheme: Litter Collection (+75 pts/bola)
        "res_eating_while_riding",    # Scheme: Cursed Dinner (+75 pts/vez)
        # ── Temporal (para time-weighting en entrenamiento) ───────────────────
        "match_date"
    ]

    final_cols = class_cols + ally_cols + enemy_cols + target_cols

    # Filtrar solo las columnas que existen
    final_cols = [c for c in final_cols if c in df.columns]
    missing = [c for c in target_cols if c not in df.columns]
    if missing:
        print(f"[WARN] Columnas faltantes (se omiten): {missing}")

    df_final = df[final_cols].copy()

    # Eliminar filas con nulos en features base
    df_final = df_final.dropna(subset=["champ_class", "enemy_champ_class", "team_comp", "enemy_comp"])

    print(f"[INFO] Shape del dataset ML final: {df_final.shape}")
    print(f"[INFO] Clases únicas (champ_class): {sorted(df_final['champ_class'].unique())}")
    print(f"[INFO] Comps únicas (team_comp): {df_final['team_comp'].nunique()}")
    print(f"[INFO] Comps únicas (enemy_comp): {df_final['enemy_comp'].nunique()}")

    output_path = OUTPUT_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"[OK] Dataset ML guardado en: {output_path}")

if __name__ == "__main__":
    prepare_features()
