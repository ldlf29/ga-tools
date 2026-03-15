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

# Create a robust session with automatic retries for rate limits and timeouts
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
    # Create table for storing raw performance data.
    # Primary Key is the Moki ID + Match ID combination to ensure no duplicates for standard performance records.
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
    """Load the 180 Moki IDs from the Next.js project's metadata JSON."""
    meta_path = '../src/data/mokiMetadata.json'
    if not os.path.exists(meta_path):
        raise FileNotFoundError(f"Could not find {meta_path}. Ensure you are running this from the analytics/ folder.")
        
    with open(meta_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # Extract the 'id' value inside each object instead of the key.
        return [str(v['id']) for v in data.values() if 'id' in v]

def fetch_all_performances():
    moki_ids = get_moki_ids()
    print(f"Loaded {len(moki_ids)} Moki IDs. Starting collection...")
    
    conn = init_db()
    c = conn.cursor()
    limit = 100
    
    for moki_id in moki_ids:
        page = 1
        inserted_for_moki = 0
        total_fetched_for_moki = 0
        
        print(f"\n--- Processing Moki {moki_id} ---")
        
        while True:
            url = f"https://api.grandarena.gg/api/v1/mokis/{moki_id}/performances?page={page}&limit={limit}"
            
            try:
                res = session.get(url, headers=HEADERS, timeout=15)
                res.raise_for_status()
                
                payload = res.json()
                data = payload.get('data', [])
                
                if not data:
                    print(f"No more data requested (Page {page}). Moving to next Moki.")
                    break
                    
                added_this_batch = 0
                for item in data:
                    match_id = str(item.get('matchId') or item.get('match', {}).get('id', 'unknown'))
                    performance_id = str(item.get('id', 'unknown'))
                    
                    # Store data if match_id is present
                    c.execute("SELECT 1 FROM RAW_PERFORMANCES WHERE moki_id=? AND match_id=?", (moki_id, match_id))
                    if not c.fetchone():
                        c.execute("""
                            INSERT INTO RAW_PERFORMANCES (moki_id, match_id, raw_data)
                            VALUES (?, ?, ?)
                        """, (moki_id, match_id, json.dumps(item)))
                        added_this_batch += 1
                
                conn.commit()
                
                inserted_for_moki += added_this_batch
                total_fetched_for_moki += len(data)
                print(f"Page {page}: Fetched {len(data)}, Inserted {added_this_batch}. (Total Inserted: {inserted_for_moki})")
                
                # Check if we've reached the end
                if len(data) < limit:
                    break
                    
                page += 1
                # Sleep interval to maintain ~10 requests/second -> well below 1000/minute.
                time.sleep(0.1)
                
            except Exception as e:
                print(f"Failed to fetch Moki {moki_id} page {page}. Error: {e}")
                print("Retrying safely in 10 seconds...")
                time.sleep(10)

    conn.close()
    print("\nData collection complete.")

if __name__ == "__main__":
    fetch_all_performances()
