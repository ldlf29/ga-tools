"""
Script 2 — Preprocessing & Feature Engineering
================================================
Lee raw_matches.csv (salida del Script 1) y produce processed_matches.csv
con las features necesarias para el modelo predictivo.

Transformaciones:
  1. Calcula total_points (puntos enteros del champion consultado):
        300 * is_win
        + eliminations * 80
        + deposits * 50
        + floor(wart_distance / 80) * 45

  2. Identifica roles de cada jugador:
        - my_team:          equipo del champion consultado ("red" o "blue")
        - champ_class:      clase del champion consultado (el moki de la query)
        - ally1_class:      clase del aliado 1 (ordenados alfabéticamente)
        - ally2_class:      clase del aliado 2
        - enemy_champ_class: clase del champion enemigo (primer jugador del team
                             contrario con nombre NO genérico)
        - enemy_ally1_class: aliado enemigo 1 (orden alfabético)
        - enemy_ally2_class: aliado enemigo 2

  3. Crea feature crosses:
        - team_comp:  champ_class + "_" + ally1_class + "_" + ally2_class
        - enemy_comp: enemy_champ_class + "_" + enemy_ally1_class + "_" + enemy_ally2_class

  4.  Elimina columnas auxiliares de players (p1..p6, rp1..rp6) que ya
      fueron usadas para derivar las features anteriores.

  5. Renombra y reordena columnas para claridad.

Uso:
    python 2_preprocess.py

Salida:
    data/processed_matches.csv
"""

import re
from math import floor
from pathlib import Path

import os
import requests
from dotenv import load_dotenv

import pandas as pd

# ─── Variables de Entorno ────────────────────────────────────────────────────
ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# ─── Rutas ───────────────────────────────────────────────────────────────────

DATA_DIR    = Path(__file__).parent / "data"
INPUT_PATH  = DATA_DIR / "raw_matches.csv"
OUTPUT_PATH = DATA_DIR / "processed_matches.csv"

# Patrón de nombre genérico (no-champion)
GENERIC_NAME_RE = re.compile(r"^Moki\s*#\d+$", re.IGNORECASE)

# Win types normalizados
WIN_TYPE_MAP = {
    "eliminations": "Elimination",
    "deposits":     "Gacha",
    "wart":         "Wart",
}

MOKI_STATS_CACHE = {}

def load_moki_stats_cache():
    """Descarga stats globales de Supabase (class, dex, str, def)."""
    global MOKI_STATS_CACHE
    if not SUPABASE_URL:
        print("[WARN] NEXT_PUBLIC_SUPABASE_URL no configurado.")
        return
        
    print("[INFO] Fetching moki_stats desde Supabase...")
    url = f"{SUPABASE_URL}/rest/v1/moki_stats?select=moki_id,class,dexterity,strength,defense"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    try:
        res = requests.get(url, headers=headers).json()
        MOKI_STATS_CACHE = {
            int(row["moki_id"]): {
                "class": str(row.get("class", "")),
                "dexterity": float(row.get("dexterity", 0)),
                "strength": float(row.get("strength", 0)),
                "defense": float(row.get("defense", 0))
            } for row in res if row.get("moki_id")
        }
        print(f"[OK] {len(MOKI_STATS_CACHE)} moki stats cargados (Sub-clasing habilitado).")
    except Exception as e:
        print("[WARN] Error al obtener moki_stats:", e)

def get_effective_class(moki_id: int, fallback_class: str) -> str:
    """
    Subclassing Logic basado en metadata:
    Grinder -> Striker (DEX > STR), else Bruiser
    Sprinter -> Striker (DEX > DEF), else Defender
    """
    if moki_id not in MOKI_STATS_CACHE:
        return fallback_class
        
    stats = MOKI_STATS_CACHE[moki_id]
    base_class = stats.get("class", fallback_class) or fallback_class
    
    if base_class == "Grinder":
        dex = stats.get("dexterity", 0)
        str_val = stats.get("strength", 0)
        return "Striker" if dex > str_val else "Bruiser"
    elif base_class == "Sprinter":
        dex = stats.get("dexterity", 0)
        def_val = stats.get("defense", 0)
        return "Striker" if dex > def_val else "Defender"
        
    return base_class

OUT_OF_ROLE_DISCOUNT = 0.80

def calculate_role_adjusted_points(row) -> float:
    """
    Aplica un descuento de 0.80x a los puntos que provienen de acciones
    fuera del rol especializado del champion.
    
    Striker:  in-role = deposits.       Out-of-role = kills, wart
    Bruiser:  in-role = kills.          Out-of-role = deposits, wart
    Defender: in-role = wart.           Out-of-role = kills, deposits
    Generalist (otros): sin descuento.
    """
    cls = str(row.get("champ_class", ""))
    is_win = bool(row.get("res_won", False))
    kills = int(row.get("res_eliminations", 0) or 0)
    deposits = int(row.get("res_deposits", 0) or 0)
    wart_dist = float(row.get("res_wart_distance", 0.0) or 0.0)
    
    win_pts = 200 if is_win else 0
    kills_pts = kills * 80
    deposits_pts = deposits * 50
    wart_pts = floor(wart_dist / 80) * 40
    
    d = OUT_OF_ROLE_DISCOUNT
    
    if cls == "Striker":
        return win_pts + (kills_pts * d) + deposits_pts + (wart_pts * d)
    elif cls == "Bruiser":
        return win_pts + kills_pts + (deposits_pts * d) + (wart_pts * d)
    elif cls == "Defender":
        return win_pts + kills_pts + (deposits_pts * d) + wart_pts
    else:
        # Generalist classes: no discount
        return win_pts + kills_pts + deposits_pts + wart_pts

# ─── Punto 1: Cálculo de puntos ───────────────────────────────────────────────


def calculate_points(
    is_win:          bool | int,
    eliminations:    int,
    deposits:        int,
    wart_distance:   float,
) -> int:
    """
    Calcula los puntos del champion consultado en un match.

    Sistema oficial del juego:
        Victoria:                200 pts
        Eliminación (kill):       80 pts c/u
        Depósito (bola gacha):    50 pts c/u
        Wart (por cada 80 unds): 40 pts  (solo tramos COMPLETOS)

    Siempre retorna un entero.
    """
    pts  = 200 if is_win else 0
    pts += int(eliminations) * 80
    pts += int(deposits) * 50
    pts += floor(float(wart_distance) / 80) * 40
    return pts


# ─── Punto 2: Identificación de roles ────────────────────────────────────────


def identify_roles(row: pd.Series) -> pd.Series:
    """
    A partir de las columnas p1..p6 del raw CSV, identifica:
      - my_team            : equipo del champion consultado
      - champ_class        : clase del champion consultado
      - ally1_class        : clase de aliado 1 (menor alfabético)
      - ally2_class        : clase de aliado 2 (mayor alfabético)
      - enemy_champ_class  : clase del champion enemigo
      - enemy_ally1_class  : clase de aliado enemigo 1 (menor alfabético)
      - enemy_ally2_class  : clase de aliado enemigo 2 (mayor alfabético)

    El champion enemigo es el PRIMER jugador del equipo contrario
    que tiene un nombre personalizado (no coincide con "Moki #XXXX").
    Si todos los enemigos tienen nombre genérico, se toma el primero.
    """
    moki_tid = int(row["moki_token_id"])

    # Extraer los 6 jugadores como lista de dicts
    players = []
    for i in range(1, 7):
        if pd.isna(row.get(f"p{i}_token_id")):
            continue
        tid = int(row.get(f"p{i}_token_id", 0) or 0)
        raw_class = str(row.get(f"p{i}_class", "") or "")
        eff_class = get_effective_class(tid, raw_class)
        
        players.append({
            "token_id": tid,
            "name":     str(row.get(f"p{i}_name",     "") or ""),
            "team":     str(row.get(f"p{i}_team",     "") or ""),
            "class":    eff_class,
        })

    if not players:
        return pd.Series({
            "my_team":           "",
            "champ_class":       "",
            "ally1_class":       "",
            "ally2_class":       "",
            "enemy_champ_class": "",
            "enemy_ally1_class": "",
            "enemy_ally2_class": "",
        })

    # Identificar el champion consultado (el moki de la query)
    this_player = next((p for p in players if p["token_id"] == moki_tid), None)
    if not this_player:
        return pd.Series({
            "my_team":           "",
            "champ_class":       "",
            "ally1_class":       "",
            "ally2_class":       "",
            "enemy_champ_class": "",
            "enemy_ally1_class": "",
            "enemy_ally2_class": "",
        })

    my_team = this_player["team"]

    # Aliados: mismo equipo, distinto token
    allies = [
        p for p in players
        if p["team"] == my_team and p["token_id"] != moki_tid
    ]

    # Enemigos: equipo contrario
    enemies = [p for p in players if p["team"] != my_team]

    # Ordenar aliados y enemigos alfabéticamente por clase
    ally_classes  = sorted([a["class"] for a in allies])
    enemy_classes = [e["class"] for e in enemies]

    # Champion enemigo: el primero del equipo contrario con nombre personalizado
    enemy_champ = next(
        (e for e in enemies if not GENERIC_NAME_RE.match(e["name"])),
        enemies[0] if enemies else None,
    )
    enemy_class = enemy_champ["class"] if enemy_champ else ""

    # Los otros 2 enemigos son los no-champions (ordenados)
    other_enemies = [
        e["class"] for e in enemies
        if e["token_id"] != (enemy_champ["token_id"] if enemy_champ else -1)
    ]
    other_enemies.sort()

    return pd.Series({
        "my_team":           my_team,
        "champ_class":       this_player["class"],
        "ally1_class":       ally_classes[0]  if len(ally_classes)  > 0 else "",
        "ally2_class":       ally_classes[1]  if len(ally_classes)  > 1 else "",
        "enemy_champ_token_id": int(enemy_champ["token_id"]) if enemy_champ else 0,
        "enemy_champ_class": enemy_class,
        "enemy_ally1_class": other_enemies[0] if len(other_enemies) > 0 else "",
        "enemy_ally2_class": other_enemies[1] if len(other_enemies) > 1 else "",
    })


# ─── Punto 3: Feature crosses ────────────────────────────────────────────────


def create_comp_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Crea las columnas:
        team_comp  = champ_class + "_" + ally1_class + "_" + ally2_class
        enemy_comp = enemy_champ_class + "_" + enemy_ally1_class + "_" + enemy_ally2_class
    """
    df["team_comp"] = (
        df["champ_class"].str.upper()
        + "_" + df["ally1_class"].str.upper()
        + "_" + df["ally2_class"].str.upper()
    )
    df["enemy_comp"] = (
        df["enemy_champ_class"].str.upper()
        + "_" + df["enemy_ally1_class"].str.upper()
        + "_" + df["enemy_ally2_class"].str.upper()
    )
    return df


# ─── Punto 4: Eliminar columnas auxiliares ───────────────────────────────────


def drop_raw_player_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Elimina las columnas p1..p6 y rp1..rp6 (ya usadas para derivar roles)."""
    cols_to_drop = [c for c in df.columns if re.match(r"^(p|rp)\d+_", c)]
    return df.drop(columns=cols_to_drop)


# ─── Pipeline principal ───────────────────────────────────────────────────────


def preprocess(
    input_path:  Path = INPUT_PATH,
    output_path: Path = OUTPUT_PATH,
) -> pd.DataFrame:

    print(f"[INFO] Leyendo {input_path}...")
    load_moki_stats_cache()
    df = pd.read_csv(input_path, low_memory=False)
    print(f"[INFO] Shape inicial: {df.shape}")

    # ── 1. Calcular puntos ─────────────────────────────────────────────────────
    df["total_points"] = df.apply(
        lambda r: calculate_points(
            is_win        = bool(r["res_won"]),
            eliminations  = int(r.get("res_eliminations", 0) or 0),
            deposits      = int(r.get("res_deposits", 0) or 0),
            wart_distance = float(r.get("res_wart_distance", 0.0) or 0.0),
        ),
        axis=1,
    )
    print(f"[INFO] Puntos calculados. Promedio: {df['total_points'].mean():.1f} | Rango: {df['total_points'].min()}–{df['total_points'].max()}")

    # ── 2. Identificar roles ───────────────────────────────────────────────────
    print("[INFO] Identificando roles de jugadores...")
    roles = df.apply(identify_roles, axis=1)
    df = pd.concat([df, roles], axis=1)

    # ── 2b. Ajuste de puntos por rol (descuento fuera-de-rol) ─────────────────
    raw_avg = df["total_points"].mean()
    df["total_points"] = df.apply(calculate_role_adjusted_points, axis=1)
    adj_avg = df["total_points"].mean()
    print(f"[INFO] Role Discount aplicado (0.80x fuera-de-rol). Promedio: {raw_avg:.1f} → {adj_avg:.1f}")

    # ── 3. Feature crosses ─────────────────────────────────────────────────────
    df = create_comp_features(df)

    # ── 4. Normalizar win_type ─────────────────────────────────────────────────
    df["win_condition"] = df["res_win_type"].map(WIN_TYPE_MAP).fillna(df["res_win_type"])

    # ── 5. Columna is_win (int) ────────────────────────────────────────────────
    df["is_win"] = df["res_won"].astype(int)

    # ── 6. Eliminar columnas auxiliares ───────────────────────────────────────
    df = drop_raw_player_cols(df)

    # ── 7. Descartar filas sin composición válida ──────────────────────────────
    before = len(df)
    df = df[
        df["champ_class"].notna() & (df["champ_class"] != "") &
        df["ally1_class"].notna() & (df["ally1_class"] != "") &
        df["ally2_class"].notna() & (df["ally2_class"] != "") &
        df["enemy_champ_class"].notna() & (df["enemy_champ_class"] != "")
    ]
    removed = before - len(df)
    if removed:
        print(f"[INFO] Filas descartadas por composición incompleta: {removed}")

    # ── 8. Reordenar columnas ──────────────────────────────────────────────────
    priority_cols = [
        "moki_token_id", "match_id", "match_date",
        "is_win", "total_points", "win_condition",
        "champ_class", "ally1_class", "ally2_class", "team_comp",
        "enemy_champ_class", "enemy_ally1_class", "enemy_ally2_class", "enemy_comp",
        "my_team", "match_team_won",
        "res_eliminations", "res_deposits", "res_wart_distance",
        "res_deaths", "res_ended_game", "res_wart_ride_seconds",
        "res_buff_time_seconds", "res_wart_closer",
        "match_duration", "match_game_type",
    ]
    extra_cols = [c for c in df.columns if c not in priority_cols]
    df = df[priority_cols + extra_cols]

    # ── Resumen ────────────────────────────────────────────────────────────────
    print(f"\n[INFO] Shape final: {df.shape}")
    print(f"[INFO] Win rate: {df['is_win'].mean():.2%}")
    print(f"[INFO] Comps únicas (team):  {df['team_comp'].nunique()}")
    print(f"[INFO] Comps únicas (enemy): {df['enemy_comp'].nunique()}")
    print(f"[INFO] Clases únicas: {sorted(df['champ_class'].unique())}")
    print(f"\n[INFO] Distribución de puntos:")
    print(df["total_points"].describe())

    # Verificar que los puntos son enteros
    non_int = df[df["total_points"] % 1 != 0]
    if len(non_int):
        print(f"[WARN] Hay {len(non_int)} filas con puntos no enteros — revisar fórmula")
    else:
        print("[OK] Todos los puntos son enteros.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"\n[OK] Dataset guardado: {output_path}")

    return df


if __name__ == "__main__":
    preprocess()
