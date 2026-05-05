"""
Script 1 — Download Match History from Supabase
================================================
Downloads ALL match history from moki_match_history (April 6+).
Extracts ALL 6 players' performance stats (not just the champion's).
Also downloads moki_stats snapshot for stats analysis.

Output:
  - data/raw_specialized.csv   (all matches with full player stats)
  - data/moki_stats_snapshot.csv (stats snapshot for Layer 7)
  - data/analysis/01_download_report.md
"""

import pandas as pd
import requests
import json
import time
import re
from datetime import datetime, timedelta
from pathlib import Path

from config import (
    SUPABASE_URL, SUPABASE_KEY, supabase_headers, fetch_moki_stats,
    DATA_DIR, ANALYSIS_DIR, GENERIC_NAME_RE,
    ensure_dirs, save_report, print_separator
)

# ─── Config ──────────────────────────────────────────────────────────────────

RAW_OUTPUT    = DATA_DIR / "raw_specialized.csv"
STATS_OUTPUT  = DATA_DIR / "moki_stats_snapshot.csv"

# ─── Download from Supabase ──────────────────────────────────────────────────

def download_match_history():
    """Download ALL rows from moki_match_history using date-based pagination."""
    print_separator("DOWNLOADING MATCH HISTORY FROM SUPABASE")
    
    base_url = f"{SUPABASE_URL}/rest/v1/moki_match_history?select=match_data,moki_id"
    headers = supabase_headers()
    
    all_data = []
    current_date = datetime.now() + timedelta(days=1)
    consecutive_empty = 0
    max_empty = 15
    
    while True:
        if current_date.date() < datetime(2026, 4, 6).date():
            print("[INFO] Reached April 6 cutoff. Stopping.")
            break
        
        if consecutive_empty >= max_empty:
            print(f"[INFO] {max_empty} consecutive empty days. Stopping.")
            break
        
        date_str = current_date.strftime("%Y-%m-%d")
        from_idx = 0
        chunk_size = 1000
        day_total = 0
        has_more = True
        
        while has_more:
            to_idx = from_idx + chunk_size - 1
            page_headers = {**headers, "Range": f"{from_idx}-{to_idx}", "Prefer": "count=exact"}
            url = f"{base_url}&match_date=eq.{date_str}"
            
            success = False
            batch = []
            for attempt in range(1, 6):
                try:
                    r = requests.get(url, headers=page_headers, timeout=30)
                    if r.status_code in [200, 206]:
                        batch = r.json()
                        success = True
                        break
                    print(f"  [WARN] Status {r.status_code} for {date_str} row {from_idx}. Retry {attempt}/5...")
                    time.sleep(5 if r.status_code == 500 else 2 * attempt)
                except Exception as e:
                    print(f"  [WARN] Network error: {e}. Retry {attempt}/5...")
                    time.sleep(5)
            
            if not success:
                print(f"  [ERROR] Failed for {date_str} row {from_idx}. Skipping day.")
                break
            
            if not batch:
                has_more = False
                break
            
            all_data.extend(batch)
            day_total += len(batch)
            from_idx += len(batch)
            
            if len(batch) < chunk_size:
                has_more = False
        
        if day_total > 0:
            print(f"  [{date_str}] {day_total} matches. Total: {len(all_data)}")
            consecutive_empty = 0
        else:
            consecutive_empty += 1
        
        current_date -= timedelta(days=1)
    
    print(f"\n[OK] Download complete. Total entries: {len(all_data)}")
    return all_data

# ─── Extract Raw Rows ────────────────────────────────────────────────────────

def extract_match_row(match_json: dict, moki_token_id: int) -> dict | None:
    """
    Extract a single match row with ALL 6 players' stats.
    This is the key difference from the current pipeline — we keep companion stats.
    """
    match = match_json
    match_result = match.get("result", {})
    players = match.get("players", [])
    rp_list = match_result.get("players", [])
    
    # Find the queried champion in the players list
    target_player = next(
        (p for p in players if p.get("mokiTokenId") == moki_token_id), None
    )
    if not target_player:
        return None
    
    target_moki_id = target_player.get("mokiId")
    
    # Find champion's stats in result.players
    target_stats = next(
        (rp for rp in rp_list if rp.get("mokiId") == target_moki_id), None
    )
    if not target_stats:
        return None
    
    # Determine win
    team_won = str(match_result.get("teamWon", "")).lower()
    player_team = str(target_player.get("team", "")).lower()
    is_win = (team_won == player_team) if team_won and player_team else False
    
    row = {
        "moki_token_id": moki_token_id,
        "match_id":      match.get("id"),
        "match_date":    match.get("matchDate", ""),
        "is_win":        is_win,
        "res_won":       is_win,
        "res_win_type":  match_result.get("winType", ""),
        "res_eliminations":  int(target_stats.get("eliminations", 0)),
        "res_deposits":      int(target_stats.get("deposits", 0)),
        "res_wart_distance": float(target_stats.get("wartDistance", 0.0)),
        "res_deaths":        int(target_stats.get("deaths", 0)),
        "res_wart_closer":   target_stats.get("wartCloser", False),
        "res_wart_ride_seconds": float(target_stats.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds": float(target_stats.get("buffTimeSeconds", 0.0)),
        "match_duration": float(match_result.get("duration", 0.0)),
        "match_team_won": str(match_result.get("teamWon", "")),
        "my_team": player_team,
    }
    
    # ── Extract ALL 6 players with positions ──────────────────────────────────
    # Build a lookup: mokiId → stats from result.players
    rp_lookup = {}
    for rp in rp_list:
        rp_lookup[rp.get("mokiId")] = rp
    
    for i, p in enumerate(players[:6], 1):
        p_moki_id = p.get("mokiId", "")
        p_token_id = p.get("mokiTokenId")
        p_team = str(p.get("team", "")).lower()
        p_name = p.get("name", "")
        p_class = p.get("class", "")
        
        row[f"p{i}_moki_id"]  = p_moki_id
        row[f"p{i}_token_id"] = p_token_id
        row[f"p{i}_name"]     = p_name
        row[f"p{i}_team"]     = p_team
        row[f"p{i}_class"]    = p_class
        
        # Find this player's performance stats
        p_stats = rp_lookup.get(p_moki_id, {})
        row[f"p{i}_eliminations"]      = int(p_stats.get("eliminations", 0))
        row[f"p{i}_deposits"]          = int(p_stats.get("deposits", 0))
        row[f"p{i}_wart_distance"]     = float(p_stats.get("wartDistance", 0.0))
        row[f"p{i}_deaths"]            = int(p_stats.get("deaths", 0))
        row[f"p{i}_wart_closer"]       = p_stats.get("wartCloser", False)
        row[f"p{i}_wart_ride_seconds"] = float(p_stats.get("wartRideTimeSeconds", 0.0))
        row[f"p{i}_buff_time_seconds"] = float(p_stats.get("buffTimeSeconds", 0.0))
    
    return row

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ensure_dirs()
    
    # 1. Download match history
    supabase_data = download_match_history()
    if not supabase_data:
        print("[ERROR] No data downloaded from Supabase.")
        return
    
    # 2. Extract raw rows
    print_separator("EXTRACTING RAW ROWS")
    rows = []
    errors = 0
    for entry in supabase_data:
        match_json = entry.get("match_data")
        moki_id = entry.get("moki_id")
        if match_json and moki_id:
            row = extract_match_row(match_json, moki_id)
            if row:
                rows.append(row)
            else:
                errors += 1
    
    df = pd.DataFrame(rows)
    print(f"[INFO] Extracted {len(df)} rows ({errors} failed)")
    
    # Deduplicate
    before = len(df)
    df.drop_duplicates(subset=["match_id", "moki_token_id"], inplace=True)
    print(f"[INFO] Deduplication: {before} → {len(df)} rows")
    
    # Save
    df.to_csv(RAW_OUTPUT, index=False)
    print(f"[OK] Raw data saved: {RAW_OUTPUT} ({len(df)} rows)")
    
    # 3. Download moki_stats
    print_separator("DOWNLOADING MOKI STATS")
    stats = fetch_moki_stats()
    stats_df = pd.DataFrame([
        {"moki_id": mid, **data} for mid, data in stats.items()
    ])
    stats_df.to_csv(STATS_OUTPUT, index=False)
    print(f"[OK] Stats snapshot saved: {STATS_OUTPUT} ({len(stats_df)} mokis)")
    
    # 4. Generate report
    print_separator("GENERATING DOWNLOAD REPORT")
    
    # Date range
    dates = pd.to_datetime(df["match_date"]).dt.date
    date_min, date_max = dates.min(), dates.max()
    
    # Class distribution (of the queried champion)
    # We need to determine champ class — use p{i} matching
    champ_classes = []
    for _, row in df.iterrows():
        tid = row["moki_token_id"]
        for i in range(1, 7):
            if row.get(f"p{i}_token_id") == tid:
                champ_classes.append(row.get(f"p{i}_class", "Unknown"))
                break
        else:
            champ_classes.append("Unknown")
    df["_champ_class"] = champ_classes
    
    class_dist = df["_champ_class"].value_counts()
    win_by_class = df.groupby("_champ_class")["is_win"].mean() * 100
    
    # Matches per date
    matches_per_day = dates.value_counts().sort_index()
    
    report = f"""# Download Report — Specialized Pipeline

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary

| Metric | Value |
|--------|-------|
| Total matches downloaded | {len(supabase_data)} |
| Valid rows extracted | {len(df)} |
| Extraction errors | {errors} |
| Date range | {date_min} → {date_max} |
| Unique champions | {df['moki_token_id'].nunique()} |
| Unique match IDs | {df['match_id'].nunique()} |
| Moki stats snapshot | {len(stats_df)} mokis |

## Champion Class Distribution

| Class | Matches | % of Total | Avg Win Rate |
|-------|---------|-----------|--------------|
"""
    for cls in class_dist.index:
        count = class_dist[cls]
        pct = count / len(df) * 100
        wr = win_by_class.get(cls, 0)
        report += f"| {cls} | {count} | {pct:.1f}% | {wr:.1f}% |\n"
    
    # Striker and Defender specific
    striker_count = class_dist.get("Striker", 0)
    defender_count = class_dist.get("Defender", 0)
    
    report += f"""
## Meta Classes Focus

| Class | Matches | Sufficient for Training? |
|-------|---------|--------------------------|
| **Striker** | {striker_count} | {'✅ Yes' if striker_count > 5000 else '⚠️ May need augmentation'} |
| **Defender** | {defender_count} | {'✅ Yes' if defender_count > 5000 else '⚠️ May need augmentation'} |

> Minimum recommended: 5,000 rows per class for robust training.

## Matches Per Day (Last 10 Days)

| Date | Matches |
|------|---------|
"""
    for date, count in matches_per_day.tail(10).items():
        report += f"| {date} | {count} |\n"
    
    report += f"""
## Stats Snapshot Summary

| Stat | Min | Mean | Max |
|------|-----|------|-----|
| Total Stats | {stats_df['total_stats'].min():.0f} | {stats_df['total_stats'].mean():.0f} | {stats_df['total_stats'].max():.0f} |
| Defense | {stats_df['defense'].min():.0f} | {stats_df['defense'].mean():.0f} | {stats_df['defense'].max():.0f} |
| Dexterity | {stats_df['dexterity'].min():.0f} | {stats_df['dexterity'].mean():.0f} | {stats_df['dexterity'].max():.0f} |
| Speed | {stats_df['speed'].min():.0f} | {stats_df['speed'].mean():.0f} | {stats_df['speed'].max():.0f} |
| Strength | {stats_df['strength'].min():.0f} | {stats_df['strength'].mean():.0f} | {stats_df['strength'].max():.0f} |
| Fortitude | {stats_df['fortitude'].min():.0f} | {stats_df['fortitude'].mean():.0f} | {stats_df['fortitude'].max():.0f} |

## Next Step

Run `python 2_extract_class_data.py` to filter and enrich data for Striker/Defender analysis.
"""
    
    # Drop temp column before final save
    df.drop(columns=["_champ_class"], inplace=True)
    df.to_csv(RAW_OUTPUT, index=False)
    
    save_report("01_download_report.md", report)
    print(f"\n[DONE] Download complete. {len(df)} matches ready for extraction.")

if __name__ == "__main__":
    main()
