"""
Script: retrain_v2.py
======================
Coordinador de re-entrenamiento para modelos V2 (Especializados).

Pasos:
  1. 2_extract_class_data.py (Extracción Striker/Defender y Enriquecimiento)
  2. 4_retrain_v2_models.py   (Entrenamiento con Hyperparámetros Guardados)
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
    print("  V2 RETRAIN COORDINATOR (Specialized)")
    print("="*60)

    # Validar que exista la data raw specialized
    raw_path = SCRIPT_DIR / "data" / "raw_specialized.csv"
    if not raw_path.exists():
        print(f"[ERROR] {raw_path} not found. Run 0_download_delta.py in ml/ first.")
        return

    # 1. Extract Class Data
    if not run_script("2_extract_class_data.py"): return

    # 2. Retrain Models
    if not run_script("4_retrain_v2_models.py"): return

    print("\n" + "="*60)
    print("  V2 RETRAIN COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()
