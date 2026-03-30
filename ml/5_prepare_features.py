"""
Script 5 — Preparación de Features para CatBoost
================================================
Lee `processed_matches.csv` y genera el dataset final `ml_features.csv`.
Crea la matriz de 22 features (1 champ_class, 10 ally counts, 1 enemy_champ_class, 10 enemy ally counts),
y mantiene los 3 targets (is_win, total_points, win_condition).
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

    print("[INFO] Generando arreglos de features numéricas para los conteos de aliados...")
    
    # Init ally counts to 0
    for cls in CLASSES:
        df[f"ally_{cls}_count"] = 0
        df[f"enemy_ally_{cls}_count"] = 0

    # Funciones eficientes para sumar las clases
    def count_classes(row_class1, row_class2, target_class):
        return (row_class1 == target_class).astype(int) + (row_class2 == target_class).astype(int)

    for cls in CLASSES:
        # Contar en aliados (ally1_class, ally2_class)
        df[f"ally_{cls}_count"] = count_classes(df["ally1_class"], df["ally2_class"], cls)
        # Contar en enemigos soporte (enemy_ally1_class, enemy_ally2_class)
        df[f"enemy_ally_{cls}_count"] = count_classes(df["enemy_ally1_class"], df["enemy_ally2_class"], cls)
    
    print("[INFO] Features creadas exitosamente.")

    # Variables Seleccionadas
    feature_cols = ["champ_class", "enemy_champ_class"]
    ally_cols = [f"ally_{cls}_count" for cls in CLASSES]
    enemy_cols = [f"enemy_ally_{cls}_count" for cls in CLASSES]
    target_cols = [
        "is_win", "total_points", "win_condition",
        "res_deaths", "res_deposits", "res_wart_closer"
    ]

    final_cols = feature_cols + ally_cols + enemy_cols + target_cols
    
    df_final = df[final_cols].copy()

    # Eliminar filas con nulos en las features base (raro, pero como precaución)
    df_final = df_final.dropna(subset=["champ_class", "enemy_champ_class"])

    print(f"[INFO] Shape del dataset ML: {df_final.shape}")
    
    output_path = OUTPUT_PATH
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_final.to_csv(output_path, index=False)
    print(f"[OK] Dataset ML guardado en: {output_path}")

if __name__ == "__main__":
    prepare_features()
