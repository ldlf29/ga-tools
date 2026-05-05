"""
Script: retrain_v1.py
======================
Coordinador de re-entrenamiento para modelos V1.
Basado en la lógica de 7_retrain_from_csv.py.

Pasos:
  1. 2_preprocess.py      (Limpieza y feature engineering base)
  2. 3_prepare_features.py (Generación de matrices para CatBoost)
  3. 4_train_models.py     (Entrenamiento de modelos globales)
"""

import subprocess
import os
import sys
from pathlib import Path

# Add current dir to path
SCRIPT_DIR = Path(__file__).parent
os.chdir(SCRIPT_DIR)

def run_script(script_name):
    print(f"\n" + "="*50)
    print(f"RUNNING: {script_name}")
    print("="*50)
    result = subprocess.run(["python", script_name], cwd=str(SCRIPT_DIR))
    if result.returncode != 0:
        print(f"\n[ERROR] {script_name} failed with return code {result.returncode}")
        return False
    return True

def main():
    print("="*60)
    print("  V1 RETRAIN COORDINATOR")
    print("="*60)

    # Validar que exista la data raw
    raw_path = SCRIPT_DIR / "data" / "raw_matches.csv"
    if not raw_path.exists():
        print(f"[ERROR] {raw_path} not found. Run 0_download_delta.py first.")
        return

    # 1. Preprocess
    if not run_script("2_preprocess.py"): return

    # 2. Prepare Features
    if not run_script("3_prepare_features.py"): return

    # 3. Train Models
    if not run_script("4_train_models.py"): return

    print("\n" + "="*60)
    print("  V1 RETRAIN COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()
