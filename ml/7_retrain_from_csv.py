"""
Script 7 — Retrain from Local CSV
===================================
Lee raw_matches.csv local (generado por 0_download_delta.py) y reentrena
los modelos V1 sin descargar nada de Supabase.

Ejecutar localmente cada 2-3 días tras correr 0_download_delta.py.
"""

import pandas as pd
import importlib
import os
from pathlib import Path
from dotenv import load_dotenv

# Add parent dir to path to import from ml/
import sys
sys.path.append(str(Path(__file__).parent))

_preprocess   = importlib.import_module("2_preprocess")
_train_models = importlib.import_module("4_train_models")

identify_roles       = _preprocess.identify_roles
calculate_points     = _preprocess.calculate_points
create_comp_features = _preprocess.create_comp_features
drop_raw_player_cols = _preprocess.drop_raw_player_cols
WIN_TYPE_MAP         = _preprocess.WIN_TYPE_MAP
MODELS_DIR           = _train_models.MODELS_DIR

DATA_DIR = Path(__file__).parent / "data"
RAW_PATH = DATA_DIR / "raw_matches.csv"

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

def main():
    print("=" * 50)
    print("RETRAIN FROM LOCAL CSV (V1)")
    print("=" * 50)

    if not RAW_PATH.exists():
        print(f"[ERROR] {RAW_PATH} not found.")
        print("[INFO] Run ml/0_download_delta.py first to download match history.")
        return

    df = pd.read_csv(RAW_PATH)
    print(f"[OK] Loaded {len(df)} rows from {RAW_PATH.name}")

    before = len(df)
    df.drop_duplicates(subset=["match_id", "moki_token_id"], inplace=True)
    print(f"[INFO] Deduplication: {before} → {len(df)} rows")

    if df.empty:
        print("[WARNING] No valid rows. Skipping retrain.")
        return

    # Preprocess → features → train
    print("\n" + "=" * 50)
    print("PREPROCESSING")
    print("=" * 50)
    preprocess_mod = importlib.import_module("2_preprocess")
    preprocess_mod.preprocess()

    print("\n" + "=" * 50)
    print("PREPARING FEATURES")
    print("=" * 50)
    prepare_mod = importlib.import_module("3_prepare_features")
    prepare_mod.prepare_features()

    print("\n" + "=" * 50)
    print("TRAINING MODELS (with time weighting)")
    print("=" * 50)
    train_mod = importlib.import_module("4_train_models")
    train_mod.train_models()

    print("\n[OK] V1 Retrain complete.")

    # --- V2 Retrain ---
    print("\n" + "=" * 60)
    print("INICIANDO RE-ENTRENAMIENTO MODELO V2 (ESPECIALIZADO)")
    print("=" * 60)

    import subprocess
    v2_dir = Path(__file__).parent / "specialized"
    
    def run_v2_script(script_name):
        print(f"\n>>> Ejecutando V2: {script_name}")
        # Usamos cwd para que el script de V2 encuentre sus propios paths relativos
        result = subprocess.run(["python", script_name], cwd=str(v2_dir))
        if result.returncode != 0:
            print(f"!!! Error en {script_name}")
            return False
        return True

    # 1. Extracción de datos V2
    if run_v2_script("2_extract_class_data.py"):
        # 2. Entrenamiento V2 (Striker/Defender) con parámetros óptimos guardados
        run_v2_script("4_retrain_v2_models.py")

    print("\n" + "=" * 60)
    print("RETRAIN TOTAL FINALIZADO (V1 + V2)")
    print("=" * 60)
    print(f"  V1 Models: {MODELS_DIR}")
    print(f"  V2 Models: {v2_dir / 'models'}")
    print("Push los archivos .cbm actualizados a GitHub.")



if __name__ == "__main__":
    main()
