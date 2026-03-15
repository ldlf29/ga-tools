import sqlite3
import json
import os
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv("../.env.local")

db_path = "data/matches.db"
if not os.path.exists(db_path):
    print("SQLite database not found.")
    exit()

conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute("SELECT moki_id, raw_data FROM RAW_PERFORMANCES")
rows = c.fetchall()

print(f"Processing {len(rows)} matching entries from SQLite list...")

daily_scores = [] # List of dict { moki_id, date, score }
seen_matches = {} # deduplication dict: {moki_id: set([match_id])}

for row in rows:
    try:
         raw = json.loads(row[1])
    except:
         continue
         
    target_date = raw.get('updatedAt') or raw.get('matchDate')
    if not target_date:
        continue
    
    date_only = target_date.split('T')[0]
    if date_only < '2026-02-18':
        continue
        
    # 🛠️ STARTING BOUNDARY CUTOFF (Event Launch Time: ~02:00 UTC Feb 20)
    if date_only == '2026-02-20' and target_date < '2026-02-20T02:00:00Z':
        continue # Skip pre-event testing matches on launch day
        
    moki_hex_id = raw.get('mokiId')
    match_data = raw.get('match', {})
    players = match_data.get('players', [])
    match_outcome = match_data.get('result', {})
    results = raw.get('results', {})
    match_id = raw.get('matchId')
    
    # Identify Token ID correctly as our primary Moki Reference
    for p in players:
        p_moki_id = p.get('mokiId')
        p_token_id = str(p.get('tokenId'))
        
        if not p_token_id: continue
        if p_moki_id != moki_hex_id: continue 
        
        # 🕵️‍♂️ DEDUPLICATION ISOLATED PER MOKI
        if p_token_id not in seen_matches:
            seen_matches[p_token_id] = set()
        if match_id in seen_matches[p_token_id]:
            continue
        
        moki_team = p.get('team')
        team_won = match_outcome.get('teamWon')
        winner = (moki_team == team_won) if moki_team is not None and team_won is not None else False
        
        # 🎯 GET EXACT STATS FOR THIS SPECIFIC MOKI
        match_players_results = match_outcome.get('players', [])
        p_deposits = 0
        p_eliminations = 0
        p_wart_distance = 0
        
        for mpr in match_players_results:
             if mpr.get('mokiId') == p_moki_id:
                  p_deposits = mpr.get('deposits', 0)
                  p_eliminations = mpr.get('eliminations', 0)
                  p_wart_distance = mpr.get('wartDistance', 0)
                  break
        
        score = (300 if winner else 0) + (p_deposits * 50) + (p_eliminations * 80) + (int(p_wart_distance / 80) * 45)
        
        daily_scores.append({
            "moki_id": p_token_id,
            "date": date_only,
            "score": score
        })
        
        seen_matches[p_token_id].add(match_id)

conn.close()

if not daily_scores:
    print("No matches parsed validly for condition limits.")
    exit()

# Convert list to DataFrame to group and aggregate daily accurately
print("\n--- Aggregating scores locally across array matrices ---")
df = pd.DataFrame(daily_scores)
df_daily = df.groupby(['moki_id', 'date'])['score'].sum().reset_index()

# Compute Ranks to match structure exactly
print("Computing standard positions rank values...")
df_daily['daily_rank'] = df_daily.groupby('date')['score'].rank(method='min', ascending=False).astype(int)
df_daily.rename(columns={'score': 'daily_score'}, inplace=True)

# 3. Synchronize to Supabase via Bulk Upsert RPC fallback
print(f"\n--- Uploading {len(df_daily)} aggregated daily rows to Supabase ---")
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

# 🛠️ CLEAR PREVIOUS STALE ROWS (Ghost Rows) First!
print("Purging stale leaderboard rows since 2026-02-18 in Supabase...")
requests.delete(f"{url}/rest/v1/daily_leaderboard?date=gte.2026-02-18", headers=headers)

records = df_daily.to_dict(orient='records')
DB_CHUNK = 200

success_count = 0
for i in range(0, len(records), DB_CHUNK):
    chunk = records[i:i+DB_CHUNK]
    # Add on_conflict parameter to the URL
    response = requests.post(f"{url}/rest/v1/daily_leaderboard?on_conflict=moki_id,date", headers=headers, json=chunk)
    if response.status_code in [200, 201, 204]:
         success_count += len(chunk)
         print(f"Uploaded {success_count}/{len(records)} rows...")
    else:
         print(f"Error chunk at offset {i}: {response.status_code} - {response.text}")

print(f"✅ Sync complete. Pushed {success_count} rows updated into daily_leaderboard.")
