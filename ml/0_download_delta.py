"""
Script 0 — Delta Download: moki_match_history → raw_matches.csv + raw_specialized.csv
======================================================================================
Descarga ÚNICAMENTE las filas nuevas (delta) desde Supabase moki_match_history
y las agrega a ambos archivos CSV locales:
  - ml/data/raw_matches.csv         (formato V1: 1 row por champion/moki)
  - ml/specialized/data/raw_specialized.csv (formato V2: 6 jugadores por match)

Cómo funciona:
  1. Lee la última fecha registrada en cada CSV local.
  2. Descarga desde Supabase solo las filas con match_date > última fecha.
  3. Procesa el delta y hace append a ambos CSVs.

Primera ejecución: si los CSVs ya existen, solo trae el delta desde el último día.
Si no existen, trae todo desde el 6 de abril de 2026 (cutoff).
"""

import pandas as pd
import requests
import json
import re
import time
import os
from pathlib import Path
from datetime import datetime, timedelta
from math import floor
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent

RAW_V1_PATH  = SCRIPT_DIR / "data" / "raw_matches.csv"
RAW_V2_PATH  = SCRIPT_DIR / "specialized" / "data" / "raw_specialized.csv"

ENV_PATH = PROJECT_ROOT / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

CUTOFF_DATE  = datetime(2026, 4, 6)
GENERIC_NAME_RE = re.compile(r"^Moki\s*#\d+$", re.IGNORECASE)

# ─── Detect last date in existing CSVs ───────────────────────────────────────

def get_last_date(csv_path: Path, date_col: str = "match_date") -> datetime:
    """Returns the latest date in the CSV, or the CUTOFF_DATE if CSV doesn't exist."""
    if csv_path.exists():
        try:
            df = pd.read_csv(csv_path, usecols=[date_col])
            if not df.empty:
                last = pd.to_datetime(df[date_col], errors="coerce").max()
                if pd.notna(last):
                    print(f"  [OK] Last date in {csv_path.name}: {last.date()}")
                    return last.to_pydatetime()
        except Exception as e:
            print(f"  [WARN] Could not read {csv_path.name}: {e}")
    print(f"  [INFO] {csv_path.name} not found or empty. Starting from cutoff: {CUTOFF_DATE.date()}")
    return CUTOFF_DATE

# ─── Download delta from Supabase ────────────────────────────────────────────

def download_delta(start_date: datetime) -> list:
    """
    Downloads match history rows from start_date to today.
    Returns list of raw Supabase entries (match_data, moki_id).
    """
    print(f"\n[Supabase] Downloading delta from {start_date.date()} to today...")
    
    base_url = f"{SUPABASE_URL}/rest/v1/moki_match_history?select=match_data,moki_id,match_date"
    headers  = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }

    all_data = []
    current_date = datetime.now() + timedelta(days=1)

    while True:
        if current_date.date() < start_date.date():
            print(f"[INFO] Reached start date {start_date.date()}. Download complete.")
            break

        date_str = current_date.strftime("%Y-%m-%d")
        from_idx   = 0
        chunk_size = 1000
        day_total  = 0
        has_more   = True

        while has_more:
            to_idx       = from_idx + chunk_size - 1
            page_headers = {**headers, "Range": f"{from_idx}-{to_idx}", "Prefer": "count=exact"}
            url          = f"{base_url}&match_date=eq.{date_str}"

            success = False
            batch   = []
            for attempt in range(1, 6):
                try:
                    r = requests.get(url, headers=page_headers, timeout=30)
                    if r.status_code in [200, 206]:
                        batch   = r.json()
                        success = True
                        break
                    print(f"  [WARN] HTTP {r.status_code} for {date_str} row {from_idx}. Retry {attempt}/5...")
                    time.sleep(30 if r.status_code == 500 else 2 * attempt)
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
            from_idx  += len(batch)

            if len(batch) < chunk_size:
                has_more = False

        if day_total > 0:
            print(f"  [{date_str}] {day_total} rows. Accumulated: {len(all_data)}")

        current_date -= timedelta(days=1)

    print(f"\n[INFO] Delta download complete. Total rows: {len(all_data)}")
    return all_data

# ─── V1 extraction (champion-only row) ───────────────────────────────────────

def extract_v1_row(match_json: dict, moki_token_id: int) -> dict | None:
    """Extracts 1 row per champion moki (V1 format). Same logic as 7_retrain_from_supabase.py."""
    match        = match_json
    match_result = match.get("result", {})
    players      = match.get("players", [])
    rp_list      = match_result.get("players", [])

    target_player = next((p for p in players if p.get("mokiTokenId") == moki_token_id), None)
    if not target_player:
        return None

    target_moki_id    = target_player.get("mokiId")
    target_moki_stats = next((rp for rp in rp_list if rp.get("mokiId") == target_moki_id), None)
    if not target_moki_stats:
        return None

    team_won    = str(match_result.get("teamWon", "")).lower()
    player_team = str(target_player.get("team", "")).lower()
    is_win      = (team_won == player_team) if team_won and player_team else False

    row = {
        "moki_token_id":          moki_token_id,
        "perf_id":                f"{match.get('id')}_{moki_token_id}",
        "match_id":               match.get("id"),
        "match_date":             match.get("matchDate", datetime.now().isoformat()),
        "is_bye":                 False,
        "res_won":                is_win,
        "res_win_type":           match_result.get("winType", ""),
        "res_eliminations":       int(target_moki_stats.get("eliminations", 0)),
        "res_deposits":           int(target_moki_stats.get("deposits", 0)),
        "res_wart_distance":      float(target_moki_stats.get("wartDistance", 0.0)),
        "res_deaths":             int(target_moki_stats.get("deaths", 0)),
        "res_ended_game":         target_moki_stats.get("endedGame", False),
        "res_wart_ride_seconds":  float(target_moki_stats.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds":  float(target_moki_stats.get("buffTimeSeconds", 0.0)),
        "res_wart_closer":        target_moki_stats.get("wartCloser", False),
        "res_eaten_by_wart":      int(target_moki_stats.get("eatenByWart", 0)),
        "res_loose_ball_pickups": int(target_moki_stats.get("looseBallPickups", 0)),
        "res_eating_while_riding": int(target_moki_stats.get("eatingWhileRiding", 0)),
        "match_game_type":        match.get("gameType", ""),
        "match_team_won":         str(match_result.get("teamWon", "")),
        "match_win_type":         match_result.get("winType", ""),
        "match_duration":         float(match_result.get("duration", 0.0)),
        "match_ended_by":         match_result.get("gameEndedBy", ""),
    }

    for i, p in enumerate(players[:6], 1):
        row[f"p{i}_moki_id"]  = p.get("mokiId", "")
        row[f"p{i}_token_id"] = p.get("mokiTokenId")
        row[f"p{i}_name"]     = p.get("name", "")
        row[f"p{i}_team"]     = str(p.get("team", ""))
        row[f"p{i}_class"]    = p.get("class", "")

    rp_lookup = {rp.get("mokiId"): rp for rp in rp_list}
    for i, p in enumerate(players[:6], 1):
        p_moki_id = p.get("mokiId", "")
        p_stats   = rp_lookup.get(p_moki_id, {})
        row[f"rp{i}_moki_id"]           = p_moki_id
        row[f"rp{i}_eliminations"]      = int(p_stats.get("eliminations", 0))
        row[f"rp{i}_deposits"]          = int(p_stats.get("deposits", 0))
        row[f"rp{i}_wart_distance"]     = float(p_stats.get("wartDistance", 0.0))
        row[f"rp{i}_deaths"]            = int(p_stats.get("deaths", 0))
        row[f"rp{i}_ended_game"]        = p_stats.get("endedGame", False)
        row[f"rp{i}_wart_ride_seconds"] = float(p_stats.get("wartRideTimeSeconds", 0.0))
        row[f"rp{i}_buff_time_seconds"] = float(p_stats.get("buffTimeSeconds", 0.0))
        row[f"rp{i}_wart_closer"]       = p_stats.get("wartCloser", False)
        row[f"rp{i}_eaten_by_wart"]     = int(p_stats.get("eatenByWart", 0))

    return row

# ─── V2 extraction (6-player row) ────────────────────────────────────────────

def extract_v2_row(match_json: dict, moki_token_id: int) -> dict | None:
    """Extracts 1 row per champion moki with ALL 6 players' stats (V2 format)."""
    match        = match_json
    match_result = match.get("result", {})
    players      = match.get("players", [])
    rp_list      = match_result.get("players", [])

    target_player = next((p for p in players if p.get("mokiTokenId") == moki_token_id), None)
    if not target_player:
        return None

    target_moki_id = target_player.get("mokiId")
    target_stats   = next((rp for rp in rp_list if rp.get("mokiId") == target_moki_id), None)
    if not target_stats:
        return None

    team_won    = str(match_result.get("teamWon", "")).lower()
    player_team = str(target_player.get("team", "")).lower()
    is_win      = (team_won == player_team) if team_won and player_team else False

    row = {
        "moki_token_id":         moki_token_id,
        "match_id":              match.get("id"),
        "match_date":            match.get("matchDate", ""),
        "is_win":                is_win,
        "res_won":               is_win,
        "res_win_type":          match_result.get("winType", ""),
        "res_eliminations":      int(target_stats.get("eliminations", 0)),
        "res_deposits":          int(target_stats.get("deposits", 0)),
        "res_wart_distance":     float(target_stats.get("wartDistance", 0.0)),
        "res_deaths":            int(target_stats.get("deaths", 0)),
        "res_wart_closer":       target_stats.get("wartCloser", False),
        "res_wart_ride_seconds": float(target_stats.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds": float(target_stats.get("buffTimeSeconds", 0.0)),
        "match_duration":        float(match_result.get("duration", 0.0)),
        "match_team_won":        str(match_result.get("teamWon", "")),
        "my_team":               player_team,
    }

    rp_lookup = {rp.get("mokiId"): rp for rp in rp_list}
    for i, p in enumerate(players[:6], 1):
        p_moki_id = p.get("mokiId", "")
        p_token   = p.get("mokiTokenId")
        p_team    = str(p.get("team", "")).lower()
        p_name    = p.get("name", "")
        p_class   = p.get("class", "")

        row[f"p{i}_moki_id"]  = p_moki_id
        row[f"p{i}_token_id"] = p_token
        row[f"p{i}_name"]     = p_name
        row[f"p{i}_team"]     = p_team
        row[f"p{i}_class"]    = p_class

        p_stats = rp_lookup.get(p_moki_id, {})
        row[f"p{i}_eliminations"]      = int(p_stats.get("eliminations", 0))
        row[f"p{i}_deposits"]          = int(p_stats.get("deposits", 0))
        row[f"p{i}_wart_distance"]     = float(p_stats.get("wartDistance", 0.0))
        row[f"p{i}_deaths"]            = int(p_stats.get("deaths", 0))
        row[f"p{i}_wart_closer"]       = p_stats.get("wartCloser", False)
        row[f"p{i}_wart_ride_seconds"] = float(p_stats.get("wartRideTimeSeconds", 0.0))
        row[f"p{i}_buff_time_seconds"] = float(p_stats.get("buffTimeSeconds", 0.0))

    return row

# ─── Append delta to CSV ──────────────────────────────────────────────────────

def append_to_csv(new_rows: list, csv_path: Path, dedup_cols: list[str]):
    """
    Appends new_rows to csv_path, deduplicating by dedup_cols.
    If CSV doesn't exist, creates it.
    """
    if not new_rows:
        print(f"  [SKIP] No new rows for {csv_path.name}")
        return

    df_new = pd.DataFrame(new_rows)
    df_new.drop_duplicates(subset=dedup_cols, inplace=True)

    if csv_path.exists():
        df_existing = pd.read_csv(csv_path)
        before      = len(df_existing)
        df_combined = pd.concat([df_existing, df_new], ignore_index=True)
        df_combined.drop_duplicates(subset=dedup_cols, keep="last", inplace=True)
        added = len(df_combined) - before
        df_combined.to_csv(csv_path, index=False)
        print(f"  [OK] {csv_path.name}: {before} → {len(df_combined)} rows (+{added} new)")
    else:
        csv_path.parent.mkdir(parents=True, exist_ok=True)
        df_new.to_csv(csv_path, index=False)
        print(f"  [OK] {csv_path.name}: created with {len(df_new)} rows")

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  0_download_delta.py — Supabase Delta Downloader")
    print("=" * 60)

    # 1. Detect start date (the later of the two CSVs, so we get delta for both)
    print("\n[Step 1] Detecting last known dates in local CSVs...")
    last_v1 = get_last_date(RAW_V1_PATH, date_col="match_date")
    last_v2 = get_last_date(RAW_V2_PATH, date_col="match_date")

    # We start from 1 day after the EARLIEST last date to fill both files
    start_from = min(last_v1, last_v2) + timedelta(days=1)
    print(f"\n  → Downloading delta starting from: {start_from.date()}")

    # Estimate egress saved
    total_days     = (datetime.now() - CUTOFF_DATE).days
    delta_days     = (datetime.now() - start_from).days + 1
    savings_pct    = max(0, (1 - delta_days / max(total_days, 1)) * 100)
    print(f"  → Egress savings estimate: {savings_pct:.0f}% vs. full download ({delta_days} days vs. {total_days} total)")

    # 2. Download delta from Supabase
    print("\n[Step 2] Downloading delta from Supabase...")
    raw_data = download_delta(start_from)

    if not raw_data:
        print("\n[INFO] No new data in Supabase since last download. Both CSVs are up to date.")
        return

    # 3. Process rows for V1 and V2
    print(f"\n[Step 3] Processing {len(raw_data)} entries into V1 and V2 formats...")
    v1_rows, v2_rows = [], []
    v1_errors, v2_errors = 0, 0

    for entry in raw_data:
        match_json = entry.get("match_data")
        moki_id    = entry.get("moki_id")
        if not match_json or not moki_id:
            continue

        row_v1 = extract_v1_row(match_json, moki_id)
        if row_v1:
            v1_rows.append(row_v1)
        else:
            v1_errors += 1

        row_v2 = extract_v2_row(match_json, moki_id)
        if row_v2:
            v2_rows.append(row_v2)
        else:
            v2_errors += 1

    print(f"  V1: {len(v1_rows)} rows extracted ({v1_errors} failed)")
    print(f"  V2: {len(v2_rows)} rows extracted ({v2_errors} failed)")

    # 4. Append to CSVs
    print("\n[Step 4] Appending delta to local CSVs...")
    append_to_csv(v1_rows, RAW_V1_PATH,  dedup_cols=["match_id", "moki_token_id"])
    append_to_csv(v2_rows, RAW_V2_PATH, dedup_cols=["match_id", "moki_token_id"])

    print("\n[DONE] Delta download complete.")
    print(f"  V1: {RAW_V1_PATH}")
    print(f"  V2: {RAW_V2_PATH}")
    print(f"  Egress saved this run: ~{savings_pct:.0f}% vs. full download")


if __name__ == "__main__":
    main()
