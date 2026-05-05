"""
Script 2 — Extract & Enrich Class-Specific Data
================================================
Takes raw_specialized.csv and produces enriched datasets for Strikers and Defenders.

Key operations:
  1. Identify roles (champion, allies, enemies) per match
  2. Extract companion performance stats (kills, deposits, wart for each ally)
  3. Compute class-specific scores (Striker: deposits-only, Defender: kills+wart)
  4. Join moki_stats (total_stats, individual stats for champion and enemy)
  5. Compute companion role labels (depositor / killer / wart_runner)
  6. Filter to Striker and Defender champion rows

Output:
  - data/striker_matches.csv
  - data/defender_matches.csv
  - data/analysis/02_extraction_report.md
"""

import pandas as pd
import numpy as np
from pathlib import Path
from collections import defaultdict

from config import (
    DATA_DIR, ANALYSIS_DIR, CLASSES, GENERIC_NAME_RE,
    striker_score, defender_score, total_points,
    get_effective_class, get_display_class,
    ensure_dirs, save_report, print_separator
)

# ─── Paths ────────────────────────────────────────────────────────────────────

RAW_INPUT       = DATA_DIR / "raw_specialized.csv"
STATS_INPUT     = DATA_DIR / "moki_stats_snapshot.csv"
STRIKER_OUTPUT  = DATA_DIR / "striker_matches.csv"
DEFENDER_OUTPUT = DATA_DIR / "defender_matches.csv"

# ─── Role Identification ─────────────────────────────────────────────────────

def identify_roles_and_stats(row: pd.Series, stats_map: dict) -> dict | None:
    """
    Identifies champion, allies, and enemies, extracting performance stats for ALL players.
    Returns enriched feature dict or None if data is incomplete.
    """
    moki_tid = row["moki_token_id"]
    
    # Build player list with stats
    players = []
    for i in range(1, 7):
        tid_col = f"p{i}_token_id"
        if pd.isna(row.get(tid_col)):
            continue
        
        tid = int(row.get(tid_col, 0) or 0)
        raw_class = str(row.get(f"p{i}_class", "") or "")
        
        # Apply subclassing from stats
        stats = stats_map.get(tid, {})
        eff_class = get_effective_class(
            raw_class,
            stats.get("dexterity", 0),
            stats.get("strength", 0),
            stats.get("defense", 0)
        )
        display_class = get_display_class(
            raw_class,
            stats.get("dexterity", 0),
            stats.get("strength", 0),
            stats.get("defense", 0)
        )
        
        players.append({
            "token_id": tid,
            "name": str(row.get(f"p{i}_name", "") or ""),
            "team": str(row.get(f"p{i}_team", "") or ""),
            "class": eff_class,
            "display_class": display_class,
            "raw_class": raw_class,
            # Performance stats for this player
            "eliminations": int(row.get(f"p{i}_eliminations", 0) or 0),
            "deposits": int(row.get(f"p{i}_deposits", 0) or 0),
            "wart_distance": float(row.get(f"p{i}_wart_distance", 0.0) or 0.0),
            "deaths": int(row.get(f"p{i}_deaths", 0) or 0),
            "wart_closer": bool(row.get(f"p{i}_wart_closer", False)),
            "wart_ride_seconds": float(row.get(f"p{i}_wart_ride_seconds", 0.0) or 0.0),
            "buff_time_seconds": float(row.get(f"p{i}_buff_time_seconds", 0.0) or 0.0),
            # Stats
            "total_stats": stats.get("total_stats", 0),
            "stat_defense": stats.get("defense", 0),
            "stat_dexterity": stats.get("dexterity", 0),
            "stat_fortitude": stats.get("fortitude", 0),
            "stat_speed": stats.get("speed", 0),
            "stat_strength": stats.get("strength", 0),
        })
    
    if len(players) < 4:
        return None
    
    # Find the champion
    this_player = next((p for p in players if p["token_id"] == moki_tid), None)
    if not this_player:
        return None
    
    my_team = this_player["team"]
    
    # Separate allies and enemies
    allies = [p for p in players if p["team"] == my_team and p["token_id"] != moki_tid]
    enemies = [p for p in players if p["team"] != my_team]
    
    if not enemies:
        return None
    
    # Enemy champion: first non-generic name, or first enemy
    enemy_champ = next(
        (e for e in enemies if not GENERIC_NAME_RE.match(e["name"])),
        enemies[0]
    )
    enemy_allies = [e for e in enemies if e["token_id"] != enemy_champ["token_id"]]
    
    # Sort allies and enemy allies alphabetically by class
    allies.sort(key=lambda p: p["class"])
    enemy_allies.sort(key=lambda p: p["class"])
    
    # Build feature dict
    result = {
        # ── Champion info ────────────────────────────────────────
        "champ_class":       this_player["class"],
        "champ_display_class": this_player["display_class"],
        "champ_token_id":    moki_tid,
        "champ_total_stats": this_player["total_stats"],
        "champ_defense":     this_player["stat_defense"],
        "champ_dexterity":   this_player["stat_dexterity"],
        "champ_fortitude":   this_player["stat_fortitude"],
        "champ_speed":       this_player["stat_speed"],
        "champ_strength":    this_player["stat_strength"],
        
        # ── Enemy champion info ──────────────────────────────────
        "enemy_champ_class":       enemy_champ["class"],
        "enemy_champ_display_class": enemy_champ["display_class"],
        "enemy_champ_token_id":    enemy_champ["token_id"],
        "enemy_champ_total_stats": enemy_champ["total_stats"],
        "enemy_champ_defense":     enemy_champ["stat_defense"],
        "enemy_champ_dexterity":   enemy_champ["stat_dexterity"],
        "enemy_champ_fortitude":   enemy_champ["stat_fortitude"],
        "enemy_champ_speed":       enemy_champ["stat_speed"],
        "enemy_champ_strength":    enemy_champ["stat_strength"],
        
        # ── Stats deltas ─────────────────────────────────────────
        "stats_delta":        this_player["total_stats"] - enemy_champ["total_stats"],
        "delta_defense":      this_player["stat_defense"] - enemy_champ["stat_defense"],
        "delta_dexterity":    this_player["stat_dexterity"] - enemy_champ["stat_dexterity"],
        "delta_fortitude":    this_player["stat_fortitude"] - enemy_champ["stat_fortitude"],
        "delta_speed":        this_player["stat_speed"] - enemy_champ["stat_speed"],
        "delta_strength":     this_player["stat_strength"] - enemy_champ["stat_strength"],
        
        # ── Match metadata ───────────────────────────────────────
        "match_id":    row["match_id"],
        "match_date":  row["match_date"],
        "is_win":      int(row["is_win"]),
        "res_win_type": row.get("res_win_type", ""),
        "match_duration": row.get("match_duration", 0),
        
        # ── Champion performance ─────────────────────────────────
        "res_eliminations":  int(row.get("res_eliminations", 0) or 0),
        "res_deposits":      int(row.get("res_deposits", 0) or 0),
        "res_wart_distance": float(row.get("res_wart_distance", 0.0) or 0.0),
        "res_deaths":        int(row.get("res_deaths", 0) or 0),
        "res_wart_closer":   int(bool(row.get("res_wart_closer", False))),
    }
    
    # ── Compositions ─────────────────────────────────────────────
    ally_classes = [a["class"] for a in allies]
    enemy_ally_classes = [e["class"] for e in enemy_allies]
    
    result["ally1_class"] = ally_classes[0] if len(ally_classes) > 0 else ""
    result["ally2_class"] = ally_classes[1] if len(ally_classes) > 1 else ""
    result["enemy_ally1_class"] = enemy_ally_classes[0] if len(enemy_ally_classes) > 0 else ""
    result["enemy_ally2_class"] = enemy_ally_classes[1] if len(enemy_ally_classes) > 1 else ""
    
    result["team_comp"] = "_".join([result["champ_class"].upper()] + [c.upper() for c in ally_classes])
    result["enemy_comp"] = "_".join([result["enemy_champ_class"].upper()] + [c.upper() for c in enemy_ally_classes])
    
    # ── Class counts ─────────────────────────────────────────────
    for cls in CLASSES:
        result[f"ally_{cls}_count"] = ally_classes.count(cls)
        result[f"enemy_ally_{cls}_count"] = enemy_ally_classes.count(cls)
    
    # ── Companion performance stats (key for Layer 6) ────────────
    for idx, ally in enumerate(allies[:2], 1):
        result[f"ally{idx}_token_id"]        = ally["token_id"]
        result[f"ally{idx}_class"]           = ally["class"]
        result[f"ally{idx}_eliminations"]    = ally["eliminations"]
        result[f"ally{idx}_deposits"]        = ally["deposits"]
        result[f"ally{idx}_wart_distance"]   = ally["wart_distance"]
        result[f"ally{idx}_deaths"]          = ally["deaths"]
        result[f"ally{idx}_wart_closer"]     = int(ally["wart_closer"])
        result[f"ally{idx}_wart_ride"]       = ally["wart_ride_seconds"]
        result[f"ally{idx}_buff_time"]       = ally["buff_time_seconds"]
    
    # Pad if less than 2 allies
    for idx in range(len(allies) + 1, 3):
        result[f"ally{idx}_token_id"]        = 0
        result[f"ally{idx}_class"]           = ""
        result[f"ally{idx}_eliminations"]    = 0
        result[f"ally{idx}_deposits"]        = 0
        result[f"ally{idx}_wart_distance"]   = 0.0
        result[f"ally{idx}_deaths"]          = 0
        result[f"ally{idx}_wart_closer"]     = 0
        result[f"ally{idx}_wart_ride"]       = 0.0
        result[f"ally{idx}_buff_time"]       = 0.0
    
    # ── Enemy champion performance ───────────────────────────────
    result["enemy_champ_eliminations"] = enemy_champ["eliminations"]
    result["enemy_champ_deposits"]     = enemy_champ["deposits"]
    result["enemy_champ_wart_distance"] = enemy_champ["wart_distance"]
    
    # ── Class-specific scores ────────────────────────────────────
    result["striker_score"]  = striker_score(row["is_win"], row.get("res_deposits", 0))
    result["defender_score"] = defender_score(row["is_win"], row.get("res_eliminations", 0), row.get("res_wart_distance", 0))
    result["total_points"]   = total_points(row["is_win"], row.get("res_eliminations", 0), row.get("res_deposits", 0), row.get("res_wart_distance", 0))
    
    return result

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ensure_dirs()
    
    print_separator("EXTRACTING CLASS-SPECIFIC DATA")
    
    # Load raw data
    print(f"[INFO] Loading {RAW_INPUT}...")
    df_raw = pd.read_csv(RAW_INPUT, low_memory=False)
    print(f"[INFO] Raw rows: {len(df_raw)}")
    
    # Load moki_stats
    print(f"[INFO] Loading {STATS_INPUT}...")
    stats_df = pd.read_csv(STATS_INPUT)
    stats_map = {}
    for _, row in stats_df.iterrows():
        mid = int(row["moki_id"])
        stats_map[mid] = {
            "class": row.get("class", ""),
            "dexterity": float(row.get("dexterity", 0) or 0),
            "strength": float(row.get("strength", 0) or 0),
            "defense": float(row.get("defense", 0) or 0),
            "fortitude": float(row.get("fortitude", 0) or 0),
            "speed": float(row.get("speed", 0) or 0),
            "total_stats": float(row.get("total_stats", 0) or 0),
        }
    print(f"[INFO] Stats map: {len(stats_map)} mokis")
    
    # Process each row
    print("[INFO] Extracting roles and companion stats...")
    processed = []
    errors = 0
    for idx, row in df_raw.iterrows():
        result = identify_roles_and_stats(row, stats_map)
        if result:
            processed.append(result)
        else:
            errors += 1
        
        if (idx + 1) % 10000 == 0:
            print(f"  Processed {idx + 1}/{len(df_raw)} ({len(processed)} valid, {errors} errors)")
    
    df = pd.DataFrame(processed)
    print(f"\n[INFO] Total processed: {len(df)} valid rows ({errors} errors)")
    
    # ── Filter to Striker and Defender ────────────────────────────────────────
    df_striker = df[df["champ_class"] == "Striker"].copy()
    df_defender = df[df["champ_class"] == "Defender"].copy()
    
    print(f"[INFO] Striker matches: {len(df_striker)}")
    print(f"[INFO] Defender matches: {len(df_defender)}")
    
    # Save
    df_striker.to_csv(STRIKER_OUTPUT, index=False)
    df_defender.to_csv(DEFENDER_OUTPUT, index=False)
    print(f"[OK] Saved {STRIKER_OUTPUT}")
    print(f"[OK] Saved {DEFENDER_OUTPUT}")
    
    print(f"\n[DONE] Extraction complete. Striker: {len(df_striker)} | Defender: {len(df_defender)}")

if __name__ == "__main__":
    main()
