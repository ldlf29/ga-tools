import pandas as pd
import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv

# 1. Cargar variables de entorno (Priorizando .env.local)
ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
# Usamos Service Role si está disponible, sino Anon
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERROR] No se encontraron las credenciales de Supabase en el .env.local")
        return

    print(f"[INFO] Descargando ranking actual de Supabase...")
    
    # Query: traemos todo de moki_predictions_ranking ordenado por score
    url = f"{SUPABASE_URL}/rest/v1/moki_predictions_ranking?select=*&order=score.desc"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            print(f"[ERROR] Error al conectar con Supabase: {response.status_code}")
            print(response.text)
            return

        data = response.json()
        if not data:
            print("[WARNING] La tabla de rankings está vacía.")
            return

        print(f"[INFO] Se encontraron {len(data)} registros. Procesando CSV...")

        # 2. Convertir a DataFrame
        df = pd.DataFrame(data)

        # 3. Mapear nombres de columnas internos a legibles (opcional para tu uso local)
        # Esto revierte el mapeo que hicimos en cron_sync_upcoming.ts
        column_mapping = {
            'moki_id': 'Moki ID',
            'name': 'Name',
            'class': 'Class',
            'score': 'Score',
            'win_rate': 'WinRate',
            'wart_closer': 'Wart Closer',
            'losses': 'Losses',
            'gacha_pts': 'Gacha Pts',
            'deaths': 'Deaths',
            'win_by_combat': 'Win By Combat',
            'fur': 'Fur',
            'traits': 'Traits',
            'eliminations_pct': 'Win Cond: Eliminations (%)',
            'wart_pct': 'Win Cond: Wart (%)',
            'gacha_pct': 'Win Cond: Gacha (%)',
            'effective_date': 'Effective Date',
            'updated_at': 'Synced At'
        }
        
        # Filtramos solo las columnas que existen en el mapping (para quitar IDs internos de Supabase si los hay)
        available_cols = [col for col in column_mapping.keys() if col in df.columns]
        df = df[available_cols].rename(columns=column_mapping)

        # 4. Guardar archivo
        output_dir = Path(__file__).parent / "data"
        output_dir.mkdir(parents=True, exist_ok=True)
        out_file = output_dir / "ranking_actual_supabase.csv"
        
        df.to_csv(out_file, index=False, encoding="utf-8-sig")
        
        print("\n" + "="*40)
        print(f"[OK] Ranking descargado con éxito.")
        print(f"[DIR] Ubicación: {out_file}")
        print("="*40)

    except Exception as e:
        print(f"[ERROR] Ocurrió un error inesperado: {str(e)}")

if __name__ == "__main__":
    main()
