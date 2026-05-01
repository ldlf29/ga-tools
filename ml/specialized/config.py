"""
Specialized ML Pipeline — Shared Configuration
================================================
Constants, paths, Supabase connection, and utilities used across all scripts.
This is a NEW project — nothing from the existing ml/ pipeline is imported.
"""

import os
import re
import json
import requests
from pathlib import Path
from math import floor
from dotenv import load_dotenv

# ─── Paths ────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent.parent
ML_ROOT      = Path(__file__).parent
DATA_DIR     = ML_ROOT / "data"
MODELS_DIR   = ML_ROOT / "models"
ANALYSIS_DIR = DATA_DIR / "analysis"

# Existing pipeline models (for anchor layer)
EXISTING_MODELS_DIR = PROJECT_ROOT / "ml" / "models"

# Metadata
METADATA_PATH = PROJECT_ROOT / "src" / "data" / "mokiMetadata.json"

# ─── Environment ──────────────────────────────────────────────────────────────

ENV_PATH = PROJECT_ROOT / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# ─── Constants ────────────────────────────────────────────────────────────────

CLASSES = [
    "Anchor", "Bruiser", "Center", "Defender", "Flanker",
    "Forward", "Grinder", "Sprinter", "Striker", "Support"
]

# The two meta classes we specialize on
META_CLASSES = ["Striker", "Defender"]

# Generic name pattern (non-champion companions)
GENERIC_NAME_RE = re.compile(r"^Moki\s*#\d+$", re.IGNORECASE)

# Composition weights for layers 2, 4, 5
COMP_WEIGHTS = {
    "layer2": 1.0,
    "layer4": 2.5,
    "layer5": 5.0,
}

# ─── V2: Time-Based Split ─────────────────────────────────────────────────────

TRAIN_CUTOFF = "2026-04-21"   # Train: April 6-20
VAL_CUTOFF   = "2026-04-25"   # Val:   April 21-24
# Test: April 25-27

# V2 model directories
V2_MODELS_DIR = MODELS_DIR / "v2"

# ─── Scoring Functions ───────────────────────────────────────────────────────

def striker_score(is_win: bool, deposits: int) -> int:
    """Striker-specific score: only wins + deposits matter."""
    return (200 if is_win else 0) + int(deposits) * 50

def defender_score(is_win: bool, eliminations: int, wart_distance: float) -> int:
    """Defender-specific score: wins + kills + wart distance."""
    return (200 if is_win else 0) + int(eliminations) * 80 + floor(float(wart_distance) / 80) * 40

def total_points(is_win: bool, eliminations: int, deposits: int, wart_distance: float) -> int:
    """Full game score (same as 2_preprocess.py)."""
    pts  = 200 if is_win else 0
    pts += int(eliminations) * 80
    pts += int(deposits) * 50
    pts += floor(float(wart_distance) / 80) * 40
    return pts

# ─── Subclassing Logic ───────────────────────────────────────────────────────

def get_effective_class(base_class: str, dexterity: float = 0, strength: float = 0, defense: float = 0) -> str:
    """
    Subclassing based on stats:
    - Grinder → Striker (DEX > STR), else Bruiser
    - Sprinter → Striker (DEX > DEF), else Defender
    """
    if base_class == "Grinder":
        return "Striker" if dexterity > strength else "Bruiser"
    elif base_class == "Sprinter":
        return "Striker" if dexterity > defense else "Defender"
    return base_class

def get_display_class(base_class: str, dexterity: float = 0, strength: float = 0, defense: float = 0) -> str:
    """Human-readable subclass for display (e.g., 'Grinder (S)')."""
    if base_class == "Grinder":
        return "Grinder (S)" if dexterity > strength else "Grinder (B)"
    elif base_class == "Sprinter":
        return "Sprinter (S)" if dexterity > defense else "Sprinter (D)"
    return base_class

# ─── Supabase Helpers ─────────────────────────────────────────────────────────

def supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

def fetch_moki_stats() -> dict:
    """Download moki_stats from Supabase. Returns {moki_id: {class, dex, str, def, total_stats, ...}}"""
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=*"
    headers = supabase_headers()
    
    result = {}
    try:
        res = requests.get(url, headers=headers, timeout=30)
        data = res.json()
        for row in data:
            mid = row.get("moki_id")
            if not mid:
                continue
            result[int(mid)] = {
                "name": row.get("name", ""),
                "class": row.get("class", ""),
                "dexterity": float(row.get("dexterity", 0) or 0),
                "strength": float(row.get("strength", 0) or 0),
                "defense": float(row.get("defense", 0) or 0),
                "fortitude": float(row.get("fortitude", 0) or 0),
                "speed": float(row.get("speed", 0) or 0),
                "total_stats": float(row.get("total_stats", 0) or 0),
                "stars": int(row.get("stars", 0) or 0),
            }
    except Exception as e:
        print(f"[ERROR] Failed to fetch moki_stats: {e}")
    
    return result

def load_metadata() -> dict:
    """Load mokiMetadata.json."""
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# ─── Report Helpers ───────────────────────────────────────────────────────────

def ensure_dirs():
    """Create all necessary directories."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    (MODELS_DIR / "striker").mkdir(parents=True, exist_ok=True)
    (MODELS_DIR / "defender").mkdir(parents=True, exist_ok=True)
    V2_MODELS_DIR.mkdir(parents=True, exist_ok=True)
    (V2_MODELS_DIR / "striker").mkdir(parents=True, exist_ok=True)
    (V2_MODELS_DIR / "defender").mkdir(parents=True, exist_ok=True)

def save_report(filename: str, content: str):
    """Save a markdown report to the analysis directory."""
    ensure_dirs()
    path = ANALYSIS_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[REPORT] Saved: {path}")

def print_separator(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
