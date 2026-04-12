"""
api_test_single.py — Test de 1 sola call a la API de Grand Arena
=================================================================
Descarga las performances de UN moki y muestra la estructura RAW completa
para verificar que todos los nombres de campos son correctos antes del
collect masivo.

Campos que verificamos:
  Performance record:
    - id, matchId, matchDate, isBye, results.*

  results.*:
    - won, winType, eliminations, deposits, wartDistance
    - deaths, endedGame, wartRideTimeSeconds, buffTimeSeconds
    - wartCloser, eatenByWart, looseBallPickups, eatingWhileRiding

  match.*:
    - gameType, players[], result.*

  match.result.*:
    - teamWon, winType, duration, gameEndedBy, players[]

  match.result.players[] (rp*):
    - mokiId, eliminations, deposits, wartDistance, deaths
    - endedGame, wartRideTimeSeconds, buffTimeSeconds
    - wartCloser, eatenByWart

  match.players[] (p*):
    - mokiId, mokiTokenId, name, team, class

Uso:
    python api_test_single.py

Salida:
    Imprime la estructura del primer registro y lista todos los campos
    disponibles para el mapeo.
"""

import json
from pathlib import Path
import requests
from dotenv import load_dotenv
import os

# ─── Config ──────────────────────────────────────────────────────────────────

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)

BASE_URL  = "https://api.grandarena.gg/api/v1/mokis"
BEARER    = os.getenv("GA_API_KEY", "")

# Si no tenés .env.local, podés pegar el token acá directamente:
# BEARER = "tu_token_aqui"

METADATA_PATH = Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json"


def load_first_moki_id() -> str:
    """Toma el primer token_id de mokiMetadata.json."""
    with open(METADATA_PATH, encoding="utf-8") as f:
        data = json.load(f)
    first_entry = next(iter(data.values()))
    moki_id = first_entry["id"]
    print(f"[TEST] Usando moki_id: {moki_id} (name: {first_entry.get('name', '?')})")
    return str(moki_id)


def fetch_single_page(token_id: str) -> dict:
    """Descarga la primera página de performances para el moki."""
    url = f"{BASE_URL}/{token_id}/performances"
    headers = {"Authorization": f"Bearer {BEARER}"}
    params = {"page": 1, "limit": 2}  # Solo 2 registros para el test
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def inspect_performance(perf: dict) -> None:
    """Muestra la estructura de un registro de performance."""
    print("\n" + "=" * 70)
    print("PERFORMANCE RECORD — Top-level keys:")
    print("=" * 70)
    for k, v in perf.items():
        if k not in ("results", "match"):
            print(f"  {k!r:30s} = {repr(v)[:80]}")

    # ── results ──────────────────────────────────────────────────────────────
    results = perf.get("results", {})
    print("\n─── results.* ─────────────────────────────────────────────────────────")
    for k, v in results.items():
        print(f"  results.{k!r:28s} = {repr(v)[:80]}")

    # ── match ────────────────────────────────────────────────────────────────
    match = perf.get("match", {})
    print("\n─── match.* (top-level, excl. players y result) ───────────────────────")
    for k, v in match.items():
        if k not in ("players", "result"):
            print(f"  match.{k!r:32s} = {repr(v)[:80]}")

    # ── match.result ─────────────────────────────────────────────────────────
    match_result = match.get("result", {})
    print("\n─── match.result.* (excl. players) ────────────────────────────────────")
    for k, v in match_result.items():
        if k != "players":
            print(f"  match.result.{k!r:25s} = {repr(v)[:80]}")

    # ── match.players ────────────────────────────────────────────────────────
    players = match.get("players", [])
    print(f"\n─── match.players[] — {len(players)} jugadores ─────────────────────────────────")
    if players:
        print("  [Ejemplo: jugador 0]")
        for k, v in players[0].items():
            print(f"    {k!r:28s} = {repr(v)[:80]}")

    # ── match.result.players ────────────────────────────────────────────────
    rp_list = match_result.get("players", [])
    print(f"\n─── match.result.players[] (rp*) — {len(rp_list)} jugadores ──────────────────────")
    if rp_list:
        print("  [Ejemplo: jugador 0]")
        for k, v in rp_list[0].items():
            print(f"    {k!r:28s} = {repr(v)[:80]}")

    # ── Verificación de campos esperados ─────────────────────────────────────
    print("\n" + "=" * 70)
    print("VERIFICACIÓN DE CAMPOS ESPERADOS EN 1_collect_data.py")
    print("=" * 70)

    expected_results = [
        "won", "winType", "eliminations", "deposits", "wartDistance",
        "deaths", "endedGame", "wartRideTimeSeconds", "buffTimeSeconds",
        "wartCloser", "eatenByWart", "looseBallPickups", "eatingWhileRiding",
    ]
    expected_players = ["mokiId", "mokiTokenId", "name", "team", "class"]
    expected_rp = [
        "mokiId", "eliminations", "deposits", "wartDistance", "deaths",
        "endedGame", "wartRideTimeSeconds", "buffTimeSeconds", "wartCloser", "eatenByWart",
    ]

    rp0 = rp_list[0] if rp_list else {}
    p0  = players[0]  if players  else {}

    print("\n  results.* — Campos que 1_collect_data.py mapea:")
    for field in expected_results:
        present = field in results
        val = results.get(field, "<<MISSING>>")
        status = "✅" if present else "❌ MISSING"
        print(f"  {status} results[{field!r}] = {repr(val)[:60]}")

    print("\n  match.players[0].* — Campos que se guardan como p1..p6:")
    for field in expected_players:
        present = field in p0
        val = p0.get(field, "<<MISSING>>")
        status = "✅" if present else "❌ MISSING"
        print(f"  {status} players[{field!r}] = {repr(val)[:60]}")

    print("\n  match.result.players[0].* — Campos que se guardan como rp1..rp6:")
    for field in expected_rp:
        present = field in rp0
        val = rp0.get(field, "<<MISSING>>")
        status = "✅" if present else "❌ MISSING"
        print(f"  {status} rp[{field!r}] = {repr(val)[:60]}")


def main():
    if not BEARER:
        print("[ERROR] GA_API_KEY no encontrada. Revisá .env.local o pegá el token en el script.")
        return

    print(f"[TEST] Token: {BEARER[:12]}...")

    token_id = load_first_moki_id()

    print(f"\n[TEST] Fetching performances para token_id={token_id} (limit=2)...")
    payload = fetch_single_page(token_id)

    records   = payload.get("data", [])
    pagination= payload.get("pagination", {})
    print(f"[TEST] Total de partidas disponibles: {pagination.get('total', '?')} | Páginas: {pagination.get('pages', '?')}")

    if not records:
        print("[WARN] No se encontraron registros. ¿El token_id es correcto?")
        return

    # Inspeccionamos el primer registro que NO sea bye
    perf = next((p for p in records if not p.get("isBye")), records[0])
    inspect_performance(perf)

    print("\n\n─── JSON COMPLETO del primer registro (para debug) ─────────────────────")
    print(json.dumps(perf, indent=2, ensure_ascii=False)[:4000])
    print("... [truncado si hay más]")


if __name__ == "__main__":
    main()
