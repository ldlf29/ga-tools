import os
import json
import sqlite3
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import requests.packages.urllib3.util.connection as urllib3_cn
import socket

# Force IPv4 to prevent hanging on bad IPv6 routes
urllib3_cn.allowed_gai_family = lambda: socket.AF_INET
from dotenv import load_dotenv

# Load environment variables
load_dotenv('../.env.local')
GA_API_KEY = os.getenv('GA_API_KEY')

if not GA_API_KEY:
    raise ValueError("GA_API_KEY not found in .env.local")

HEADERS = {
    'Authorization': f'Bearer {GA_API_KEY}',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}

session = requests.Session()
retry = Retry(
    total=5,
    read=5,
    connect=5,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504]
)
adapter = HTTPAdapter(max_retries=retry)
session.mount('https://', adapter)

def init_db(db_path="data/matches.db"):
    # Ensure directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS RAW_PERFORMANCES (
            moki_id TEXT,
            match_id TEXT,
            raw_data TEXT,
            PRIMARY KEY (moki_id, match_id)
        )
    ''')
    conn.commit()
    return conn

def get_moki_ids():
    meta_path = '../src/data/mokiMetadata.json'
    with open(meta_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        return [str(v['id']) for v in data.values() if 'id' in v]

def fetch_latest_10():
    moki_ids = get_moki_ids()
    print(f"Loaded {len(moki_ids)} Moki IDs. Starting collection of top 10...")
    
    conn = init_db()
    c = conn.cursor()
    limit = 10 # 🎯 FETCH EXACTLY 10
    
    inserted_total = 0
    for moki_id in moki_ids:
        # We only need Page 1
        url = f"https://api.grandarena.gg/api/v1/mokis/{moki_id}/performances?page=1&limit={limit}"
        
        try:
            res = session.get(url, headers=HEADERS, timeout=15)
            res.raise_for_status()
            
            payload = res.json()
            data = payload.get('data', [])
            
            added_this_batch = 0
            for item in data:
                match_id = str(item.get('matchId') or item.get('match', {}).get('id', 'unknown'))
                
                c.execute("SELECT 1 FROM RAW_PERFORMANCES WHERE moki_id=? AND match_id=?", (moki_id, match_id))
                if not c.fetchone():
                    c.execute("""
                        INSERT INTO RAW_PERFORMANCES (moki_id, match_id, raw_data)
                        VALUES (?, ?, ?)
                    """, (moki_id, match_id, json.dumps(item)))
                    added_this_batch += 1
            
            conn.commit()
            inserted_total += added_this_batch
            print(f"Moki {moki_id}: Fetched {len(data)}, Inserted {added_this_batch} new rows.")
            
            time.sleep(0.05) # fast paced
            
        except Exception as e:
            print(f"Failed to fetch Moki {moki_id}. Error: {e}")

    conn.close()
    print(f"\nCollection complete. Total new rows inserted: {inserted_total}")

if __name__ == "__main__":
    fetch_latest_10()
