"""
Script 1 — Data Collection (RAW)
=================================
Descarga TODOS los performances de cada moki desde la API de Grand Arena
y los guarda SIN TRANSFORMAR en data/raw_matches.csv.

Criterios de filtrado:
  - Solo partidas con matchDate <= 2026-02-20 (CUTOFF_DATE).
  - Descarta isBye == True (partidas bye no tienen oponente real).

Estructura de salida (columnas del CSV):
  - Campos de la performance record (perf_id, match_id, match_date, etc.)
  - Campos de results (stats del moki consultado en ese match)
  - Campos del match (metadata del match completo)
  - p1..p6: los 6 jugadores (token_id, nombre, equipo, clase)
  - rp1..rp6: stats individuales de cada jugador en match.result.players

El Token se lee automáticamente de .env.local (GA_API_KEY).

Uso:
    python 1_collect_data.py              # corre los 180 mokis
    python 1_collect_data.py --test-one   # solo el primer moki (para validar)

Salida:
    data/raw_matches.csv
"""

import argparse
import json
import re
import time
from datetime import date, datetime
from math import floor
from pathlib import Path
from typing import Any

import pandas as pd
import requests

# ─── Config ──────────────────────────────────────────────────────────────────

BASE_URL      = "https://api.grandarena.gg/api/v1/mokis"
CUTOFF_DATE   = date(2026, 3, 29)          # Desde este día en adelante (inclusive)
METADATA_PATH = Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json"
ENV_PATH      = Path(__file__).parent.parent / ".env.local"
OUTPUT_DIR    = Path(__file__).parent / "data"
OUTPUT_PATH   = OUTPUT_DIR / "raw_matches.csv"
LIMIT         = 100
SLEEP_S       = 0.4

# Patrón de nombre genérico de moki (no-champion)
GENERIC_NAME_RE = re.compile(r"^Moki #\d+$", re.IGNORECASE)

# ─── Helpers: configuración ───────────────────────────────────────────────────


def load_token(env_path: Path) -> str:
    """Lee GA_API_KEY de .env.local."""
    if not env_path.exists():
        raise FileNotFoundError(f"No se encontró {env_path}")
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("GA_API_KEY="):
                return line.split("=", 1)[1].strip()
    raise ValueError("GA_API_KEY no encontrada en .env.local")


def load_moki_ids(metadata_path: Path) -> list[str]:
    """Extrae los token IDs numéricos de mokiMetadata.json."""
    with open(metadata_path, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
    ids = [entry["id"] for entry in data.values()]
    print(f"[INFO] {len(ids)} moki token IDs cargados.")
    return ids


# ─── Helpers: fecha ──────────────────────────────────────────────────────────


def within_range(date_str: str) -> bool:
    """Retorna True si la fecha (YYYY-MM-DD) es >= CUTOFF_DATE (2026-02-20 en adelante)."""
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date() >= CUTOFF_DATE
    except Exception:
        return False


def before_cutoff(date_str: str) -> bool:
    """Retorna True si la fecha es ANTERIOR al cutoff (para detener la paginación)."""
    try:
        return datetime.strptime(date_str[:10], "%Y-%m-%d").date() < CUTOFF_DATE
    except Exception:
        return False


# ─── Helpers: API ────────────────────────────────────────────────────────────


def fetch_page(token_id: str, bearer: str, page: int) -> dict:
    """GET /api/v1/mokis/{token_id}/performances?page=N&limit=100"""
    url = f"{BASE_URL}/{token_id}/performances"
    headers = {"Authorization": f"Bearer {bearer}"}
    params  = {"page": page, "limit": LIMIT}
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


# ─── Extracción de fila cruda ─────────────────────────────────────────────────


def extract_raw_row(perf: dict, moki_token_id: str) -> dict | None:
    """
    Convierte un registro de la API en una fila plana con TODOS los campos.
    Retorna None si:
      - matchDate > CUTOFF_DATE
      - isBye == True

    Notas:
    - NO calcula puntos (se hace en preprocessing).
    - NO deriva features (team_comp, etc.) — eso va en preprocessing.
    - Almacena los 6 jugadores como p1..p6 (orden tal cual los devuelve la API).
    - Los stats individuales de cada jugador (de match.result.players) como rp1..rp6.
    """
    match_date = perf.get("matchDate", "")
    if not within_range(match_date):   # Descartar si es anterior al 2026-02-20
        return None

    if perf.get("isBye", False):
        return None

    results      = perf.get("results", {})
    match        = perf.get("match", {})
    match_result = match.get("result", {})
    players      = match.get("players", [])       # List of 6 player dicts
    rp_list      = match_result.get("players", []) # List of 6 result dicts

    # ── Fila base ─────────────────────────────────────────────────────────────
    row: dict[str, Any] = {
        # Identificadores
        "moki_token_id": int(moki_token_id),
        "perf_id":        perf.get("id", ""),
        "match_id":       perf.get("matchId", ""),
        "match_date":     match_date,
        "is_bye":         perf.get("isBye", False),

        # ── Resultados del moki consultado (champion propio) ──────────────────
        # Estos son los stats del moki cuyo token_id se consultó
        "res_won":               results.get("won", False),
        "res_win_type":          results.get("winType", ""),
        "res_eliminations":      int(results.get("eliminations", 0)),
        "res_deposits":          int(results.get("deposits", 0)),
        "res_wart_distance":     float(results.get("wartDistance", 0.0)),
        "res_deaths":            int(results.get("deaths", 0)),
        "res_ended_game":        results.get("endedGame", False),
        "res_wart_ride_seconds": float(results.get("wartRideTimeSeconds", 0.0)),
        "res_buff_time_seconds": float(results.get("buffTimeSeconds", 0.0)),
        "res_wart_closer":       results.get("wartCloser", False),
        "res_eaten_by_wart":     int(results.get("eatenByWart", 0)),
        "res_loose_ball_pickups":int(results.get("looseBallPickups", 0)),
        "res_eating_while_riding":int(results.get("eatingWhileRiding", 0)),

        # ── Metadata del match ────────────────────────────────────────────────
        "match_game_type":    match.get("gameType", ""),
        "match_team_won":     match_result.get("teamWon", ""),
        "match_win_type":     match_result.get("winType", ""),
        "match_duration":     float(match_result.get("duration", 0.0)),
        "match_ended_by":     match_result.get("gameEndedBy", ""),
    }

    # ── Players p1..p6 (composición de equipos) ───────────────────────────────
    # Se almacenan en el orden devuelto por la API.
    # En preprocessing se derivarán my_team, champ_class, ally1_class, etc.
    for i, p in enumerate(players[:6], 1):
        row[f"p{i}_moki_id"]  = p.get("mokiId", "")
        row[f"p{i}_token_id"] = p.get("mokiTokenId", "")
        row[f"p{i}_name"]     = p.get("name", "")
        row[f"p{i}_team"]     = p.get("team", "")
        row[f"p{i}_class"]    = p.get("class", "")

    # ── Stats individuales por jugador (match.result.players) ─────────────────
    # El orden de rp_list puede no coincidir con players; se guarda por índice.
    for i, rp in enumerate(rp_list[:6], 1):
        row[f"rp{i}_moki_id"]           = rp.get("mokiId", "")
        row[f"rp{i}_eliminations"]      = int(rp.get("eliminations", 0))
        row[f"rp{i}_deposits"]          = int(rp.get("deposits", 0))
        row[f"rp{i}_wart_distance"]     = float(rp.get("wartDistance", 0.0))
        row[f"rp{i}_deaths"]            = int(rp.get("deaths", 0))
        row[f"rp{i}_ended_game"]        = rp.get("endedGame", False)
        row[f"rp{i}_wart_ride_seconds"] = float(rp.get("wartRideTimeSeconds", 0.0))
        row[f"rp{i}_buff_time_seconds"] = float(rp.get("buffTimeSeconds", 0.0))
        row[f"rp{i}_wart_closer"]       = rp.get("wartCloser", False)
        row[f"rp{i}_eaten_by_wart"]     = int(rp.get("eatenByWart", 0))

    return row


# ─── Loop principal de recolección ───────────────────────────────────────────


def collect_all(moki_ids: list[str], bearer: str) -> pd.DataFrame:
    """
    Itera sobre todos los mokis y sus páginas de performances.

    La API pagina en orden DESCENDENTE (más recientes primero).
    Recolectamos desde CUTOFF_DATE (2026-02-20) hasta hoy.

    Optimización de parada temprana:
    Cuando TODOS los registros de una página son anteriores al cutoff,
    sabemos que todas las páginas siguientes también lo serán → paramos.
    """
    all_rows: list[dict] = []
    total = len(moki_ids)

    for idx, token_id in enumerate(moki_ids, 1):
        print(f"\n[{idx:3d}/{total}] Moki token_id={token_id}")
        moki_rows = 0
        page = 1

        while True:
            try:
                payload = fetch_page(token_id, bearer, page)
            except requests.HTTPError as exc:
                print(f"  [WARN] HTTP {exc.response.status_code} en página {page}")
                break
            except Exception as exc:
                print(f"  [WARN] Error en página {page}: {exc}")
                break

            records     = payload.get("data", [])
            pagination  = payload.get("pagination", {})
            total_pages = int(pagination.get("pages", 1))

            if not records:
                break

            page_rows  = 0
            hit_cutoff = False  # Si encontramos algo anterior al cutoff

            for perf in records:
                match_date = perf.get("matchDate", "")

                if before_cutoff(match_date):
                    # Este y todos los siguientes en la página son anteriores
                    hit_cutoff = True
                    continue  # Terminar de procesar esta página

                row = extract_raw_row(perf, token_id)
                if row:
                    all_rows.append(row)
                    page_rows += 1

            moki_rows += page_rows
            print(f"  Pág {page:3d}/{total_pages}: {page_rows:3d} válidas | Total: {moki_rows} | Stop: {hit_cutoff}")

            # Si llegamos a registros anteriores al cutoff → parar (API es DESC)
            if hit_cutoff or page >= total_pages:
                break

            page += 1
            time.sleep(SLEEP_S)

        time.sleep(SLEEP_S)

    df = pd.DataFrame(all_rows)
    return df


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--test-one", action="store_true",
                        help="Solo el primer moki (para validar)")
    args = parser.parse_args()

    bearer = load_token(ENV_PATH)
    print(f"[INFO] Token cargado: {bearer[:12]}...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    moki_ids = load_moki_ids(METADATA_PATH)
    if args.test_one:
        moki_ids = moki_ids[:1]
        print("[TEST] Solo el primer moki.")

    df = collect_all(moki_ids, bearer)

    if df.empty:
        print("[ERROR] No se recolectaron datos.")
        return

    # Deduplicar por (perf_id) — posible si un moki aparece en múltiples listas
    before = len(df)
    df.drop_duplicates(subset=["perf_id"], inplace=True)
    print(f"\n[INFO] Deduplicación: {before} → {len(df)} filas")

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"[OK] Raw dataset guardado: {OUTPUT_PATH}")
    print(f"     Columnas: {len(df.columns)} | Filas: {len(df)}")
    print(f"     Rango fechas: {df['match_date'].min()} → {df['match_date'].max()}")
    print(f"     Win rate: {df['res_won'].mean():.2%}")
    print(f"\nColumnas del CSV:")
    for col in df.columns:
        print(f"  {col}")


if __name__ == "__main__":
    main()
