"""Debug: Inspect what's actually in moki_match_history"""
import os, json, requests
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists(): load_dotenv(ENV_PATH)
else: load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

url = f"{SUPABASE_URL}/rest/v1/moki_match_history?select=match_data,token_id&limit=3&order=match_date.desc"
headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

r = requests.get(url, headers=headers)
print(f"Status: {r.status_code}")
data = r.json()
print(f"Rows returned: {len(data)}")

if data:
    entry = data[0]
    token_id = entry.get("token_id")
    match_data = entry.get("match_data")
    
    print(f"\n--- token_id ---")
    print(f"  value={token_id!r}  type={type(token_id).__name__}")
    
    print(f"\n--- match_data top-level keys ---")
    print(f"  {list(match_data.keys()) if match_data else 'NONE'}")
    
    if match_data:
        result = match_data.get("result", {})
        print(f"\n--- match_data['result'] keys ---")
        print(f"  {list(result.keys())}")
        
        rp_list = result.get("players", [])
        print(f"\n--- result['players'] count: {len(rp_list)} ---")
        if rp_list:
            rp = rp_list[0]
            print(f"  First rp keys: {list(rp.keys())}")
            print(f"  mokiTokenId={rp.get('mokiTokenId')!r}  type={type(rp.get('mokiTokenId')).__name__}")
            print(f"  Comparing: {rp.get('mokiTokenId')} == {token_id}  →  {rp.get('mokiTokenId') == token_id}")
            print(f"  Comparing (str): {str(rp.get('mokiTokenId'))} == {str(token_id)}  →  {str(rp.get('mokiTokenId')) == str(token_id)}")
        
        players = match_data.get("players", [])
        print(f"\n--- match_data['players'] count: {len(players)} ---")
        if players:
            p = players[0]
            print(f"  First player keys: {list(p.keys())}")
