"""
Script 3 — Scheme Analysis (v2)
=================================
Evalúa el Expected Value (EV) de cada Scheme de performance:
  1. POR BLOQUE DE 10 MATCHES por Champion (simulando contest blocks reales).
  2. POR CLASE del Champion (Defender, Striker, etc.) para evitar promediar
     clases naturalmente distintas (un Striker deposita mucho; un Defender no).

Método:
  - Identifica la clase del moki consultado en cada fila (desde p1..p6).
  - Corrige win_type: "gacha" (no "deposits").
  - Agrupa cada moki en bloques cronológicos de 10 matches.
  - Suma el bonus de cada scheme dentro del bloque → EV por bloque.
  - Promedia bloques por champion_class.
  - Muestra tabla: Scheme × Clase con EV / bloque de 10.

Baseline de referencia:
  - Trait Scheme (4/4): +100 pts/match/champion = +1.000 pts/bloque de 10.
  - Nota: los traits son fijos; los performance schemes se evalúan en contexto.

Win types en la API:
  "eliminations" → Moki Smash, Final Blow, Enforcing the Naughty List
  "gacha"        → Grabbing Balls, Beat the Buzzer, Gacha Hoarding
  "wart"         → Baiting the Trap, Big Game Hunt

Uso:
  python 3_scheme_analysis.py

Salida:
  data/scheme_by_class.csv  — EV por scheme × clase (bloque de 10)
  data/scheme_ranking.json  — ranking global y por clase
"""

import json
from math import floor
from pathlib import Path

import pandas as pd
import numpy as np

# ─── Config ───────────────────────────────────────────────────────────────────

DATA_DIR       = Path(__file__).parent / "data"
RAW_PATH       = DATA_DIR / "raw_matches.csv"
OUTPUT_CSV     = DATA_DIR / "scheme_by_class.csv"
OUTPUT_JSON    = DATA_DIR / "scheme_ranking.json"

TRAIT_BASELINE_PER_MATCH = 100     # pts garantizados con 4/4 traits
BLOCK_SIZE                = 10     # matches por bloque (contest)
TRAIT_BASELINE_PER_BLOCK  = TRAIT_BASELINE_PER_MATCH * BLOCK_SIZE   # 1000

# ─── Helpers ─────────────────────────────────────────────────────────────────


def si(val, default=0) -> int:
    try:
        return int(val) if pd.notna(val) else default
    except Exception:
        return default


def sf(val, default=0.0) -> float:
    try:
        return float(val) if pd.notna(val) else default
    except Exception:
        return default


def sb(val) -> bool:
    if isinstance(val, (bool, np.bool_)):
        return bool(val)
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    try:
        return bool(val)
    except Exception:
        return False


# ─── Paso 1: Derivar clase del champion from raw ─────────────────────────────


def add_champ_class(df: pd.DataFrame) -> pd.DataFrame:
    """
    Para cada fila, encuentra el jugador de p1..p6 cuyo token_id coincide
    con moki_token_id y extrae su clase.
    """
    p_tids    = [f"p{i}_token_id" for i in range(1, 7)]
    p_classes = [f"p{i}_class"    for i in range(1, 7)]

    classes = []
    for _, row in df.iterrows():
        moki_tid = int(row["moki_token_id"])
        cls = None
        for tid_col, cls_col in zip(p_tids, p_classes):
            tid_val = row.get(tid_col)
            if pd.notna(tid_val) and int(tid_val) == moki_tid:
                cls = row.get(cls_col, None)
                break
        classes.append(str(cls).strip() if cls and pd.notna(cls) else None)

    df["champ_class"] = classes
    return df


# ─── Paso 2: Calcular totales de equipo (para team-mult schemes) ──────────────


def add_team_totals(df: pd.DataFrame) -> pd.DataFrame:
    """
    Suma eliminations y deposits de los 3 miembros del equipo del moki
    usando p1..p6 (equipo) + rp1..rp6 (stats individuales).
    """
    p_tids   = [f"p{i}_token_id" for i in range(1, 7)]
    p_teams  = [f"p{i}_team"     for i in range(1, 7)]
    p_mids   = [f"p{i}_moki_id"  for i in range(1, 7)]
    rp_ids   = [f"rp{i}_moki_id"      for i in range(1, 7)]
    rp_elims = [f"rp{i}_eliminations" for i in range(1, 7)]
    rp_deps  = [f"rp{i}_deposits"     for i in range(1, 7)]

    team_elim, team_dep = [], []

    for _, row in df.iterrows():
        moki_tid = int(row["moki_token_id"])

        # Equipo del moki
        my_team = None
        team_moki_ids = set()
        for tid_col, team_col, mid_col in zip(p_tids, p_teams, p_mids):
            if pd.notna(row.get(tid_col)) and int(row[tid_col]) == moki_tid:
                my_team = row[team_col]
                break
        if my_team:
            for tid_col, team_col, mid_col in zip(p_tids, p_teams, p_mids):
                if pd.notna(row.get(team_col)) and row[team_col] == my_team:
                    if pd.notna(row.get(mid_col)):
                        team_moki_ids.add(str(row[mid_col]))

        # Sumar stats del equipo
        t_elim = t_dep = 0
        for rid, relim, rdep in zip(rp_ids, rp_elims, rp_deps):
            if pd.notna(row.get(rid)) and str(row[rid]) in team_moki_ids:
                t_elim += si(row.get(relim))
                t_dep  += si(row.get(rdep))

        team_elim.append(t_elim)
        team_dep.append(t_dep)

    df["team_eliminations"] = team_elim
    df["team_deposits"]     = team_dep
    return df


# ─── Paso 3: Score base ───────────────────────────────────────────────────────


def compute_base_score(df: pd.DataFrame) -> pd.DataFrame:
    """Puntos base del champion (sin scheme, sin rareza)."""
    df["base_score"] = (
        df["res_won"].apply(sb).astype(int) * 300
        + df["res_eliminations"].apply(si) * 80
        + df["res_deposits"].apply(si)     * 50
        + (df["res_wart_distance"].apply(sf) / 80).apply(floor) * 45
    )
    return df


# ─── Paso 4: Calculadoras de scheme por fila ─────────────────────────────────
# Cada función retorna un valor numérico para UNA fila.
# Para "replacement" schemes (Naughty List, Gacha Hoarding, Aggressive, Collective):
#   retorna la DIFERENCIA neta vs score base (puede ser negativa).


def s_gacha_gouging(r):
    return si(r.res_deposits) * 15 + si(r.res_eliminations) * 20

def s_cage_match(r):
    return si(r.res_eliminations) * 40 + si(r.res_deposits) * 10

def s_cursed_dinner(r):
    return si(r.res_eating_while_riding) * 75

def s_big_game_hunt(r):
    return 250 if (sb(r.res_ended_game) and r.match_win_type == "wart" and sb(r.res_won)) else 0

def s_taking_a_dive(r):
    return 175 if not sb(r.res_won) else 0

def s_victory_lap(r):
    return 100 if sb(r.res_won) else 0

def s_naughty_list(r):
    """x2.5 si el Moki hizo >= 5 kills, else 0. Retorna diferencia neta."""
    bs = r.base_score
    if si(r.res_eliminations) >= 5:
        return int(bs * 1.5)    # ganancia neta = bs * 2.5 - bs = bs * 1.5
    else:
        return -bs               # pierde todo el base

def s_touching_the_wart(r):
    return 125 if sb(r.res_wart_closer) else 0

def s_gacha_hoarding(r):
    """x2.5 si el Moki hizo >= 6 deposits, else 0. Retorna diferencia neta."""
    bs = r.base_score
    if si(r.res_deposits) >= 6:
        return int(bs * 1.5)
    else:
        return -bs

def s_aggressive_spec(r):
    """Elim × 1.75x, SIN gacha ni wart. Retorna diferencia neta."""
    elim_base  = si(r.res_eliminations) * 80
    gacha_base = si(r.res_deposits)     * 50
    wart_base  = floor(sf(r.res_wart_distance) / 80) * 45
    elim_bonus = int(elim_base * 0.75)   # extra del ×0.75
    return elim_bonus - gacha_base - wart_base

def s_collective_spec(r):
    """Gacha × 1.5x, SIN elim ni wart. Retorna diferencia neta."""
    elim_base  = si(r.res_eliminations) * 80
    gacha_base = si(r.res_deposits)     * 50
    wart_base  = floor(sf(r.res_wart_distance) / 80) * 45
    gacha_bonus = int(gacha_base * 0.5)
    return gacha_bonus - elim_base - wart_base

def s_beat_the_buzzer(r):
    return 250 if (sb(r.res_ended_game) and r.match_win_type == "gacha" and sb(r.res_won)) else 0

def s_final_blow(r):
    return 250 if (sb(r.res_ended_game) and r.match_win_type == "eliminations" and sb(r.res_won)) else 0

def s_grabbing_balls(r):
    return 175 if (sb(r.res_won) and r.match_win_type == "gacha") else 0

def s_baiting_the_trap(r):
    return 175 if (sb(r.res_won) and r.match_win_type == "wart") else 0

def s_moki_smash(r):
    return 175 if (sb(r.res_won) and r.match_win_type == "eliminations") else 0

def s_flexing(r):
    return floor(sf(r.res_buff_time_seconds) * 3.5)

def s_wart_rodeo(r):
    return floor(sf(r.res_wart_ride_seconds) * 3.5)

def s_litter_collection(r):
    return si(r.res_loose_ball_pickups) * 75

def s_saccing(r):
    return si(r.res_eaten_by_wart) * 100

def s_running_interference(r):
    return si(r.res_deaths) * 50


SCHEMES = [
    # (nombre display, función, categoría)
    ("Victory Lap",                s_victory_lap,          "win-result"),
    ("Taking a Dive",              s_taking_a_dive,        "win-result"),
    ("Moki Smash",                 s_moki_smash,           "win-type"),
    ("Grabbing Balls",             s_grabbing_balls,       "win-type"),
    ("Baiting the Trap",           s_baiting_the_trap,     "win-type"),
    ("Touching the Wart",          s_touching_the_wart,    "position"),
    ("Cage Match",                 s_cage_match,           "stat"),
    ("Gacha Gouging",              s_gacha_gouging,        "stat"),
    ("Running Interference",       s_running_interference, "stat"),
    ("Saccing",                    s_saccing,              "stat"),
    ("Cursed Dinner",              s_cursed_dinner,        "stat"),
    ("Litter Collection",          s_litter_collection,    "stat"),
    ("Beat the Buzzer",            s_beat_the_buzzer,      "game-ender"),
    ("Final Blow",                 s_final_blow,           "game-ender"),
    ("Big Game Hunt",              s_big_game_hunt,        "game-ender"),
    ("Flexing",                    s_flexing,              "time"),
    ("Wart Rodeo",                 s_wart_rodeo,           "time"),
    ("Enforcing the Naughty List", s_naughty_list,         "replace"),
    ("Gacha Hoarding",             s_gacha_hoarding,       "replace"),
    ("Aggressive Specialization",  s_aggressive_spec,      "replace"),
    ("Collective Specialization",  s_collective_spec,      "replace"),
]


# ─── Paso 5: Calcular bonuses de schemes ─────────────────────────────────────


def compute_scheme_bonuses(df: pd.DataFrame) -> pd.DataFrame:
    """Agrega una columna por scheme con el bonus de ese match."""
    print("[INFO] Calculando bonuses de schemes...")
    for name, fn, _ in SCHEMES:
        col = f"sch_{name}"
        df[col] = df.apply(fn, axis=1)
    return df


# ─── Paso 6: Asignar bloques de 10 por moki ──────────────────────────────────


def assign_blocks(df: pd.DataFrame) -> pd.DataFrame:
    """
    Ordena por (moki_token_id, match_date, perf_id) y asigna un número
    de bloque = cada 10 matches consecutivos por moki.
    """
    df = df.sort_values(["moki_token_id", "match_date", "perf_id"]).copy()
    df["row_within_moki"] = df.groupby("moki_token_id").cumcount()
    df["block_num"]       = df["row_within_moki"] // BLOCK_SIZE
    return df


# ─── Paso 7: Agregar por bloque y luego por clase ────────────────────────────


def aggregate_by_class(df: pd.DataFrame) -> pd.DataFrame:
    """
    Para cada (moki_token_id, block_num, champ_class), suma los bonuses de
    cada scheme en el bloque (10 matches).
    Luego agrupa por champ_class y calcula estadísticas.

    Retorna un DataFrame con índice=scheme y columnas=clases.
    """
    scheme_cols = [f"sch_{name}" for name, _, _ in SCHEMES]

    # Suma por bloque
    block_agg = df.groupby(
        ["moki_token_id", "block_num", "champ_class"],
        as_index=False
    )[scheme_cols + ["base_score"]].sum()

    # Media de bloques por clase
    class_agg = block_agg.groupby("champ_class")[scheme_cols + ["base_score"]].mean()

    return class_agg, block_agg


# ─── Paso 8: Construir tabla de resultados ────────────────────────────────────


def build_results_table(class_agg: pd.DataFrame) -> tuple[pd.DataFrame, list]:
    """
    Construye tabla con filas=schemes y columnas=clases + "GLOBAL".
    Valores = EV por bloque de 10 matches.
    """
    scheme_cols = [f"sch_{name}" for name, _, _ in SCHEMES]
    class_list  = sorted(class_agg.index.tolist())

    rows = []
    for (name, _, category), col in zip(SCHEMES, scheme_cols):
        row = {"scheme": name, "category": category}
        for cls in class_list:
            if cls in class_agg.index:
                row[cls] = round(class_agg.loc[cls, col], 1)
            else:
                row[cls] = None
        # Global (promedio de todas las clases, ponderado por número de bloques)
        row["GLOBAL"] = round(class_agg[col].mean(), 1)
        rows.append(row)

    result = pd.DataFrame(rows).sort_values("GLOBAL", ascending=False)
    result.reset_index(drop=True, inplace=True)
    return result, class_list


# ─── Paso 9: Imprimir reporte ─────────────────────────────────────────────────


def print_report(results: pd.DataFrame, class_agg: pd.DataFrame, class_list: list, avg_base_block: float) -> None:
    trait_b = TRAIT_BASELINE_PER_BLOCK

    print("\n" + "=" * 110)
    print("PUNTAJES BASE PROMEDIO POR CLASE (Bloque de 10)")
    print("=" * 110)
    for cls in class_list:
        if cls in class_agg.index:
            print(f"  {cls:<10}: {class_agg.loc[cls, 'base_score']:.0f} pts")

    print("\n" + "=" * 110)
    print("RANKING DE SCHEMES — BONUS EXTRA POR BLOQUE DE 10 MATCHES")
    print("=" * 110)
    print(f"  Baseline Trait (4/4 traits): +{trait_b:.0f} pts | Base score global promedio: {avg_base_block:.0f} pts")
    print()

    # Header
    header = f"  {'#':>2}  {'SCHEME':<28} {'GLOBAL':>7}"
    for cls in class_list:
        header += f" {cls[:10]:>10}"
    print(header)
    print("  " + "-" * (len(header) - 2 + len(class_list)))

    for i, row in results.iterrows():
        flag = ""
        if row["GLOBAL"] >= trait_b:
            flag = " ***"
        elif row["GLOBAL"] >= trait_b * 0.75:
            flag = " **"
        elif row["GLOBAL"] < 0:
            flag = " !!"

        line = (
            f"  {i+1:>2}. {row['scheme']:<28} "
            f"{row['GLOBAL']:>7.0f}{flag}"
        )
        for cls in class_list:
            val = row.get(cls)
            if val is not None:
                line += f" {val:>10.0f}"
            else:
                line += f" {'--':>10}"
        print(line)

    print()
    print(f"  BASELINE TRAIT (referencia): {trait_b:.0f} pts por bloque")
    print(f"  *** = supera o iguala el baseline trait")
    print(f"  **  = >= 75% del baseline")
    print(f"  !!  = negativo (destruye valor)")


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    print(f"[INFO] Leyendo {RAW_PATH}...")
    df = pd.read_csv(RAW_PATH, low_memory=False)
    print(f"[INFO] {len(df):,} filas | {df['moki_token_id'].nunique()} mokis únicos")

    print("[INFO] Derivando clase del champion...")
    df = add_champ_class(df)
    valid_classes = df["champ_class"].notna().sum()
    print(f"[INFO] Clases identificadas: {valid_classes:,} / {len(df):,}")
    print(f"[INFO] Clases únicas: {sorted(df['champ_class'].dropna().unique())}")

    # Ya no calculamos totales de equipo porque Naughty/Hoarding son individuales
    # print("[INFO] Calculando totales de equipo...")
    # df = add_team_totals(df)

    print("[INFO] Calculando base score...")
    df = compute_base_score(df)

    df = compute_scheme_bonuses(df)

    print("[INFO] Asignando bloques de 10...")
    df = assign_blocks(df)
    total_blocks = df.groupby(["moki_token_id", "block_num"]).ngroups
    print(f"[INFO] Total bloques de 10: {total_blocks:,}")

    # Filtrar clases válidas (descartar None/nan)
    df = df[df["champ_class"].notna() & (df["champ_class"] != "None")]

    print("[INFO] Agregando por clase y bloque...")
    class_agg, block_agg = aggregate_by_class(df)
    avg_base_block = block_agg["base_score"].mean()

    results, class_list = build_results_table(class_agg)
    print_report(results, class_agg, class_list, avg_base_block)

    # ── Guardar CSV ────────────────────────────────────────────────────────────
    results.to_csv(OUTPUT_CSV, index=False)
    print(f"\n[OK] CSV guardado: {OUTPUT_CSV}")

    # ── Guardar JSON para la app ───────────────────────────────────────────────
    
    # Extraer base scores por clase
    base_scores = {}
    for cls in class_list:
        if cls in class_agg.index:
            base_scores[cls] = round(class_agg.loc[cls, "base_score"], 1)

    out_json = {
        "baseline_trait_per_block":  TRAIT_BASELINE_PER_BLOCK,
        "avg_base_score_per_block":  round(avg_base_block, 1),
        "base_score_by_class":       base_scores,
        "block_size":                BLOCK_SIZE,
        "classes":                   class_list,
        "schemes": []
    }

    for _, row in results.iterrows():
        by_class_data = {}
        for cls in class_list:
            bonus = row.get(cls)
            base_s = base_scores.get(cls, 0)
            if bonus is not None:
                by_class_data[cls] = {
                    "bonus": bonus,
                    "total": round(base_s + bonus, 1)
                }
            else:
                by_class_data[cls] = None

        entry = {
            "scheme":   row["scheme"],
            "category": row["category"],
            "global_ev": row["GLOBAL"],
            "by_class": by_class_data
        }
        out_json["schemes"].append(entry)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(out_json, f, indent=2)
    print(f"[OK] JSON guardado: {OUTPUT_JSON}")

    # ── Win type distribution ──────────────────────────────────────────────────
    print("\n── Distribución Win Type ──")
    print(df["match_win_type"].value_counts(normalize=True).mul(100).round(1).to_string())

    # ── Distribución de partidas por clase ─────────────────────────────────────
    print("\n── Matches por Clase ──")
    print(df["champ_class"].value_counts().to_string())


if __name__ == "__main__":
    main()
