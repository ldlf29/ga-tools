import json
import time
import requests
from datetime import datetime
from pathlib import Path

# Config
BASE_URL      = "https://api.grandarena.gg/api/v1/mokis"
METADATA_PATH = Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json"
ENV_PATH      = Path(__file__).parent.parent / ".env.local"
OUTPUT_DIR    = Path(__file__).parent / "data"
OUTPUT_PATH   = OUTPUT_DIR / "historical_seed.jsonl"
LIMIT         = 100
SLEEP_S       = 0.085  # ~700 RPM

# Cutoffs by cohort
DATE_LOTE_A = datetime(2026, 3, 29).date()
DATE_LOTE_B = datetime(2026, 4, 6).date()

def load_token():
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            if line.startswith("GA_API_KEY="):
                return line.split("=", 1)[1].strip()
    return ""

def load_mokis():
    with open(METADATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    print(f"[INFO] Cargados {len(data)} Mokis del metadata.")
    
    # Split cohorts
    moki_list = list(data.values())
    lote_a = [str(m["id"]) for m in moki_list[:180]]
    lote_b = [str(m["id"]) for m in moki_list[180:]]
    
    return lote_a, lote_b

def before_cutoff(date_str, cutoff_date):
    try:
        match_date = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
        return match_date < cutoff_date
    except Exception:
        return False

def collect_cohort(moki_ids, cutoff_date, bearer, output_file):
    total = len(moki_ids)
    for idx, token_id in enumerate(moki_ids, 1):
        print(f"\n[{idx:3d}/{total}] Moki {token_id} - Hasta {cutoff_date}")
        page = 1
        moki_rows = 0
        
        while True:
            url = f"{BASE_URL}/{token_id}/performances"
            headers = {"Authorization": f"Bearer {bearer}"}
            params  = {"page": page, "limit": LIMIT}
            
            try:
                r = requests.get(url, headers=headers, params=params, timeout=20)
                r.raise_for_status()
                payload = r.json()
            except Exception as e:
                print(f"  [ERROR] Pagina {page}: {e}")
                time.sleep(1)
                break
            
            records = payload.get("data", [])
            if not records:
                break
                
            hit_cutoff = False
            valid_records = []
            
            for perf in records:
                match_date = perf.get("matchDate", "")
                if before_cutoff(match_date, cutoff_date):
                    hit_cutoff = True
                    break # Ignorar este y el resto de la pagina porque API es DESC
                
                # Agregarlo a la bolsa!
                perf["_moki_queried"] = token_id # taggear de dondé salió
                valid_records.append(perf)
                
            if valid_records:
                for v in valid_records:
                    output_file.write(json.dumps(v) + "\n")
                moki_rows += len(valid_records)
                print(f"  Pag {page}: {len(valid_records)} partidas válidas. Total Moki: {moki_rows}")
                
            if hit_cutoff or len(records) < LIMIT:
                print(f"  [STOP] Límite de fecha {cutoff_date} alcanzado o fin de paginacion.")
                break
                
            page += 1
            time.sleep(SLEEP_S)

def main():
    bearer = load_token()
    if not bearer:
        print("[ERROR] Token GA_API_KEY no encontrado")
        return
        
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    lote_a, lote_b = load_mokis()
    
    print(f"\n===========================================")
    print(f"Iniciando RECOLECCION MASIVA A JSONL")
    print(f"Rate Limit Target: ~700 RPM")
    print(f"===========================================\n")
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as out:
        print(">>> RECOLECTANDO LOTE A (180 Mokis -> 29 de Marzo)")
        collect_cohort(lote_a, DATE_LOTE_A, bearer, out)
        
        print("\n>>> RECOLECTANDO LOTE B (60 Mokis Nuevos -> 6 de Abril)")
        collect_cohort(lote_b, DATE_LOTE_B, bearer, out)
        
    print(f"\n[Terminado] Seed descargado a {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
