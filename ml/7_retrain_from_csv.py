"""
Script 7 — Master Retrain Coordinator
=======================================
Coordina el re-entrenamiento completo de todas las versiones (V1, V2, V3)
utilizando la data local descargada por 0_download_delta.py.
"""

import subprocess
import os
from pathlib import Path
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).parent
ENV_PATH = SCRIPT_DIR.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

def run_retrain(path, name):
    print(f"\n" + "!" * 60)
    print(f"  INICIANDO RE-ENTRENAMIENTO: {name}")
    print("!" * 60)
    
    script_path = SCRIPT_DIR / path
    result = subprocess.run(["python", script_path.name], cwd=str(script_path.parent))
    
    if result.returncode != 0:
        print(f"\n[ERROR] {name} falló.")
        return False
    
    print(f"\n[OK] {name} completado con éxito.")
    return True

def main():
    print("=" * 60)
    print("  GRAND ARENA TOOLS - MASTER RETRAIN")
    print("=" * 60)
    print("  Este script ejecutará secuencialmente V1, V2 y V3.")

    # 1. V1 Retrain
    if not run_retrain("retrain_v1.py", "V1 (Global Models)"):
        return

    # 2. V2 Retrain
    if not run_retrain("specialized/retrain_v2.py", "V2 (Specialized Models)"):
        return

    # 3. V3 Retrain
    if not run_retrain("v3/retrain_v3.py", "V3 (Cascade Models)"):
        return

    print("\n" + "=" * 60)
    print("  RE-ENTRENAMIENTO TOTAL FINALIZADO")
    print("=" * 60)
    print("  Modelos actualizados en:")
    print(f"  - V1: ml/models/")
    print(f"  - V2: ml/specialized/models/")
    print(f"  - V3: ml/v3/models/")
    print("\nRecuerda hacer push de los archivos .cbm a GitHub.")

if __name__ == "__main__":
    main()
