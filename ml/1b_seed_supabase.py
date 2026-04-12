import json
import os
import requests
from pathlib import Path
from dotenv import load_dotenv

DIR_PATH = Path(__file__).parent
ENV_PATH = DIR_PATH.parent / ".env.local"
METADATA_PATH = DIR_PATH.parent / "src" / "data" / "mokiMetadata.json"
INPUT_PATH = DIR_PATH / "data" / "historical_seed.jsonl"

if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

def load_metadata():
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    mapping = {}
    for key, val in data.items():
        if val.get("id"):
            mapping[int(val["id"])] = val.get("name", "Unknown")
    return mapping

def map_team(team):
    if isinstance(team, str):
        t = team.lower()
        if t == "red": return 1
        if t == "blue": return 2
    if isinstance(team, int):
        return team
    return 0

def process_file():
    if not INPUT_PATH.exists():
        print(f"[ERROR] No se halló {INPUT_PATH}. Ejecutá el 1A primero.")
        return
        
    metadata = load_metadata()
    url = f"{SUPABASE_URL}/rest/v1/moki_match_history"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Prefer": "resolution=ignore-duplicates"  # ON CONFLICT DO NOTHING
    }

    batch = []
    batch_size = 500
    total_inserted = 0
    
    print("[INFO] Leyendo e insertando histórico en Supabase...")
    
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            perf = json.loads(line)
            moki_id = int(perf.get("_moki_queried", 0))
            if not moki_id or not perf.get("match") or not perf["match"].get("result"):
                continue
                
            match = perf["match"]
            
            # Map teams
            if match.get("players"):
                for p in match["players"]:
                    p["team"] = map_team(p.get("team"))
            if match.get("result"):
                match["result"]["teamWon"] = map_team(match["result"].get("teamWon"))
                
            target_moki_hash = perf.get("mokiId")
            player_info = next((p for p in match.get("players", []) if p.get("mokiId") == target_moki_hash), {})
            perf_results = perf.get("results", {})
            meta_name = metadata.get(moki_id, player_info.get("name", "Unknown"))
            
            win_type = match["result"].get("winType", "unknown")
            if win_type == "Eliminations": win_type = "Combat"
            
            record = {
                "match_id": match.get("id"),
                "ga_moki_hash": target_moki_hash,
                "moki_id": moki_id,
                "moki_name": meta_name,
                "moki_class": player_info.get("class", ""),
                "moki_image_url": player_info.get("imageUrl", ""),
                "moki_team": player_info.get("team", 0),
                "eliminations": perf_results.get("eliminations", 0),
                "deposits": perf_results.get("deposits", 0),
                "wart_distance": float(perf_results.get("wartDistance", 0.0)),
                "ended_game": bool(perf_results.get("endedGame", False)),
                "deaths": perf_results.get("deaths", 0),
                "eating_while_riding": perf_results.get("eatingWhileRiding", 0),
                "buff_time_seconds": float(perf_results.get("buffTimeSeconds", 0.0)),
                "wart_ride_time_seconds": float(perf_results.get("wartTimeSeconds", perf_results.get("wartRideTimeSeconds", 0.0))),
                "loose_ball_pickups": perf_results.get("looseBallPickups", 0),
                "eaten_by_wart": perf_results.get("eatenByWart", perf_results.get("eatenbyWart", 0)),
                "wart_closer": bool(perf_results.get("wartCloser", False)),
                "win_type": win_type,
                "team_won": match["result"].get("teamWon", 0),
                "duration": float(match["result"].get("duration", 0.0)),
                "match_date": perf.get("matchDate", match.get("matchDate")),
                "match_data": match
            }
            
            batch.append(record)
            
            if len(batch) >= batch_size:
                resp = requests.post(url, headers=headers, json=batch)
                if resp.status_code in [200, 201]:
                    total_inserted += len(batch)
                    print(f"  [OK] Batch insertado. Total actual: {total_inserted}")
                else:
                    print(f"  [ERROR] Fallo insertando batch: {resp.status_code} - {resp.text[:200]}")
                batch = []
                
        # Last batch
        if batch:
            resp = requests.post(url, headers=headers, json=batch)
            if resp.status_code in [200, 201]:
                total_inserted += len(batch)
                print(f"  [OK] Ultimo Batch insertado. Total actual: {total_inserted}")
            else:
                print(f"  [ERROR] Fallo insertando ultimo batch: {resp.status_code} - {resp.text[:200]}")

    print(f"\n[FIN] Todo insertado con éxito. Total filas evaluadas/procesadas: {total_inserted}")

if __name__ == "__main__":
    process_file()
