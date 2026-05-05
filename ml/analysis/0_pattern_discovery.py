"""
Script 0 — Pattern Discovery (Grand Arena - Grand Arena Tools)
==============================================================
Analiza todos los patrones estadísticos relevantes del histórico de matches
usando processed_matches.csv como fuente principal.

Patrones analizados:
  1. Win condition distribution por clase
  2. Win rate by matchup (champ_class vs enemy_champ_class)
  3. Team composition win rates (min 50 matches)
  4. Companion synergies por clase (ally pair win rate)
  5. Match duration vs outcome & win type
  6. Out-of-role penalty (Striker sin deposits, Defender sin wart/kills)
  7. Moki ID matchmaking bias (repetición de enfrentamientos por bloque)
  8. Performance variance by Moki ID (quiénes tienen más inconsistencia)
  9. Buff time / Wart ride correlation con victorias

Output:
  - analysis/pattern_discovery_report.md
"""

import pandas as pd
import numpy as np
from pathlib import Path
from collections import defaultdict
from scipy import stats

# ─── Config ──────────────────────────────────────────────────────────────────

BASE_DIR     = Path(__file__).parent.parent
DATA_DIR     = BASE_DIR / "data"
ANALYSIS_DIR = BASE_DIR / "analysis"
INPUT_PATH   = DATA_DIR / "processed_matches.csv"
REPORT_PATH  = ANALYSIS_DIR / "pattern_discovery_report.md"

BLOCK_SIZE   = 2400   # rows por bloque de contest (1200 matchups efectivos)
MIN_MATCHES  = 50     # mínimo de matches para considerar un grupo estadísticamente

# ─── Utils ───────────────────────────────────────────────────────────────────

def pct(val, total):
    return round(val / total * 100, 1) if total > 0 else 0.0

def wr(df, min_n=MIN_MATCHES):
    """Win rate de un subconjunto de matches. Retorna None si n < min_n."""
    n = len(df)
    if n < min_n:
        return None, n
    return round(df["is_win"].mean() * 100, 1), n

def sep(title, char="─", width=60):
    return f"\n{'═' * width}\n  {title}\n{'═' * width}\n"

def sub(title, level=2):
    return f"\n{'#' * level} {title}\n"

def table(df, max_rows=20):
    """Generate markdown table without requiring tabulate."""
    df = df.head(max_rows).reset_index(drop=True)
    cols = df.columns.tolist()
    header = "| " + " | ".join(str(c) for c in cols) + " |"
    sep_row = "|" + "|".join(["---"] * len(cols)) + "|"
    rows = []
    for _, row in df.iterrows():
        rows.append("| " + " | ".join(str(v) for v in row.values) + " |")
    return "\n".join([header, sep_row] + rows)

def df_to_md(df):
    """Same as table() but for full DataFrames (used for pivots etc)."""
    return table(df, max_rows=len(df))

# ─── Load Data ───────────────────────────────────────────────────────────────

def load_data():
    if not INPUT_PATH.exists():
        raise FileNotFoundError(
            f"[ERROR] {INPUT_PATH} no existe. "
            "Correr ml/2_preprocess.py primero."
        )
    print(f"[INFO] Loading {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH, low_memory=False)
    # Normalize win_condition capitalization
    df["win_condition"] = df["win_condition"].str.lower().str.strip()
    print(f"[OK] Loaded {len(df):,} rows")
    return df

# ─── Pattern 1: Win Condition Distribution per Class ─────────────────────────

def p1_win_condition_distribution(df):
    lines = [sep("PATRÓN 1: Distribución de Condiciones de Victoria por Clase")]

    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        total  = len(sub_df)
        if total == 0:
            continue

        lines.append(sub(f"Clase: {cls} (n={total:,})"))
        counts = sub_df["win_condition"].value_counts()
        rows = []
        for cond, cnt in counts.items():
            cond_df = sub_df[sub_df["win_condition"] == cond]
            rows.append({
                "Condición": cond,
                "Total": cnt,
                "% del total": pct(cnt, total),
                "Win Rate %": round(cond_df["is_win"].mean() * 100, 1),
                "Avg Score": round(cond_df["total_points"].mean(), 1),
                "Std Score": round(cond_df["total_points"].std(), 1),
            })
        lines.append(table(pd.DataFrame(rows)))
        lines.append("")

    return "\n".join(lines)

# ─── Pattern 2: Win Rate by Matchup ──────────────────────────────────────────

def p2_matchup_winrate(df):
    lines = [sep("PATRÓN 2: Win Rate por Matchup (champ_class vs enemy_champ_class)")]

    # Only Striker/Defender as champ
    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        pivot  = sub_df.groupby("enemy_champ_class").agg(
            Matches=("is_win", "count"),
            WinRate=("is_win", lambda x: round(x.mean() * 100, 1)),
            AvgScore=("total_points", lambda x: round(x.mean(), 1)),
            StdScore=("total_points", lambda x: round(x.std(), 1)),
        ).reset_index()
        pivot = pivot[pivot["Matches"] >= MIN_MATCHES].sort_values("WinRate", ascending=False)
        pivot.columns = ["Enemy Class", "Matches", "Win Rate %", "Avg Score", "Std Score"]

        lines.append(sub(f"{cls} vs Enemy Classes"))
        if len(pivot) == 0:
            lines.append("_No hay suficientes datos_\n")
        else:
            lines.append(table(pivot))
        lines.append("")

    # Full cross-table
    lines.append(sub("Tabla Cruzada: Win Rate por Matchup (todas las clases)"))
    pivot_full = df.groupby(["champ_class", "enemy_champ_class"])["is_win"].agg(
        lambda x: round(x.mean() * 100, 1)
    ).unstack().reset_index()
    pivot_full.columns = [str(c) for c in pivot_full.columns]
    # Fill NaN with "-" after conversion to avoid dtype warning
    pivot_full = pivot_full.fillna("-")
    lines.append(df_to_md(pivot_full))
    lines.append("")


    return "\n".join(lines)

# ─── Pattern 3: Team Composition Win Rates ───────────────────────────────────

def p3_team_comp_winrate(df):
    lines = [sep("PATRÓN 3: Win Rate por Composición de Equipo (team_comp)")]

    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        comp_wr = sub_df.groupby("team_comp").agg(
            Matches=("is_win", "count"),
            WinRate=("is_win", lambda x: round(x.mean() * 100, 1)),
            AvgScore=("total_points", "mean")
        ).reset_index()
        comp_wr = comp_wr[comp_wr["Matches"] >= MIN_MATCHES].sort_values("WinRate", ascending=False)
        comp_wr["AvgScore"] = comp_wr["AvgScore"].round(1)
        comp_wr.columns = ["Team Comp", "Matches", "Win Rate %", "Avg Score"]

        lines.append(sub(f"{cls} — Top/Bottom Composiciones (n≥{MIN_MATCHES})"))
        lines.append("**Top 15 WR:**")
        lines.append(table(comp_wr.head(15)))
        lines.append("")
        lines.append("**Bottom 15 WR:**")
        lines.append(table(comp_wr.tail(15).sort_values("Win Rate %")))
        lines.append("")

    return "\n".join(lines)

# ─── Pattern 4: Companion Synergies ──────────────────────────────────────────

def p4_companion_synergies(df):
    lines = [sep("PATRÓN 4: Sinergias de Companions (Ally Pair Win Rate)")]

    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls].copy()
        sub_df["ally_pair"] = sub_df.apply(
            lambda r: "_".join(sorted([str(r.get("ally1_class", "")), str(r.get("ally2_class", ""))])),
            axis=1
        )

        pair_wr = sub_df.groupby("ally_pair").agg(
            Matches=("is_win", "count"),
            WinRate=("is_win", lambda x: round(x.mean() * 100, 1)),
            AvgScore=("total_points", lambda x: round(x.mean(), 1)),
            StdScore=("total_points", lambda x: round(x.std(), 1)),
        ).reset_index()
        pair_wr = pair_wr[pair_wr["Matches"] >= MIN_MATCHES].sort_values("AvgScore", ascending=False)
        pair_wr.columns = ["Ally Pair", "Matches", "Win Rate %", "Avg Score", "Std Score"]

        lines.append(sub(f"{cls} — Mejores y Peores Pares de Allies (n≥{MIN_MATCHES}) — ordenado por Avg Score"))
        lines.append("**Top 15 pares:**")
        lines.append(table(pair_wr.head(15)))
        lines.append("")
        lines.append("**Bottom 15 pares:**")
        lines.append(table(pair_wr.tail(15).sort_values("Avg Score")))
        lines.append("")

        # Also: individual ally class performance
        lines.append(sub(f"{cls} — WR y Avg Score por Ally 1 individual"))
        a1 = sub_df.groupby("ally1_class").agg(
            Matches=("is_win", "count"),
            WinRate=("is_win", lambda x: round(x.mean() * 100, 1)),
            AvgScore=("total_points", lambda x: round(x.mean(), 1)),
            StdScore=("total_points", lambda x: round(x.std(), 1)),
        ).reset_index()
        a1 = a1[a1["Matches"] >= MIN_MATCHES].sort_values("AvgScore", ascending=False)
        a1.columns = ["Ally Class", "Matches", "Win Rate %", "Avg Score", "Std Score"]
        lines.append(table(a1))
        lines.append("")

    return "\n".join(lines)

# ─── Pattern 5: Match Duration vs Outcome ────────────────────────────────────

def p5_duration_outcome(df):
    lines = [sep("PATRÓN 5: Duración de Partida vs Resultado y Tipo de Victoria")]

    # Nota metodológica
    lines.append("> ⚠️ **Nota metodológica:** El dataset tiene exactamente 1 fila ganadora y 1 perdedora")
    lines.append("> por match (el champion vs el enemy champion). Analizar el WR global por cuartil")
    lines.append("> de duración **siempre da 50%** por construcción. El análisis útil es *por clase*")
    lines.append("> y *por tipo de victoria*, que sí revelan patrones reales.\n")

    # Duración promedio win/loss POR CLASE
    lines.append(sub("Duración promedio por resultado — POR CLASE"))
    rows = []
    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        for win_val, label in [(1, "Victoria"), (0, "Derrota")]:
            sub2 = sub_df[sub_df["is_win"] == win_val]["match_duration"]
            rows.append({
                "Clase": cls, "Resultado": label,
                "Mean (s)": round(sub2.mean(), 2),
                "Median (s)": round(sub2.median(), 2),
                "Std Dev": round(sub2.std(), 2),
                "N": len(sub2),
            })
    lines.append(df_to_md(pd.DataFrame(rows)))
    lines.append("")

    # Duración por tipo de victoria
    lines.append(sub("Duración promedio por tipo de victoria"))
    dur_cond = df.groupby("win_condition")["match_duration"].agg(["mean", "median", "count"]).round(2).reset_index()
    dur_cond.columns = ["Win Condition", "Mean (s)", "Median (s)", "N Matches"]
    dur_cond = dur_cond.sort_values("Mean (s)")
    lines.append(df_to_md(dur_cond))
    lines.append("")

    # Correlación duración con victoria POR CLASE
    lines.append(sub("Correlación: duración ↔ victoria (por clase)"))
    lines.append("> r > 0: partidas más largas → más victorias para esa clase")
    lines.append("> r < 0: partidas más cortas → más victorias para esa clase\n")
    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        corr, pval = stats.pointbiserialr(sub_df["match_duration"].fillna(0), sub_df["is_win"])
        sig = "✅ significativa" if pval < 0.05 else "⚪ no significativa"
        lines.append(f"**{cls}** — r={corr:.4f}, p={pval:.4f} ({sig})")
    lines.append("")

    # Win Rate por RANGO DE DURACIÓN ABSOLUTO — solo Striker y Defender
    lines.append(sub("Win Rate por rango de duración absoluto (Striker y Defender)"))
    lines.append("> Aquí sí hay señal real porque filtramos por clase antes de calcular WR.\n")

    DURATION_BUCKETS = [
        ("< 30s",   0,   30),
        ("30-40s",  30,  40),
        ("40-50s",  40,  50),
        ("50-60s",  50,  60),
        ("60-75s",  60,  75),
        ("> 75s",   75,  9999),
    ]

    for cls in ["Striker", "Defender"]:
        cls_df = df[df["champ_class"] == cls]
        rows_b = []
        for label, lo, hi in DURATION_BUCKETS:
            # Mask computed on cls_df to avoid index mismatch warning
            mask  = (cls_df["match_duration"] >= lo) & (cls_df["match_duration"] < hi)
            sub_b = cls_df[mask]
            if len(sub_b) >= 30:
                rows_b.append({
                    "Rango": label,
                    "N": len(sub_b),
                    "Win Rate %": round(sub_b["is_win"].mean() * 100, 1),
                    "Avg Score":  round(sub_b["total_points"].mean(), 1),
                })
        if rows_b:
            lines.append(f"**{cls}:**")
            lines.append(table(pd.DataFrame(rows_b)))
            lines.append("")


    # Win Rate por duración Y win_condition (para Striker/Defender)
    lines.append(sub("Win Rate por tipo de victoria Y rango de duración"))
    for cls in ["Striker", "Defender"]:
        cls_df = df[df["champ_class"] == cls]
        cond_dur = cls_df.groupby("win_condition").agg(
            N=("is_win", "count"),
            WR=("is_win", lambda x: round(x.mean() * 100, 1)),
            AvgDur=("match_duration", lambda x: round(x.mean(), 1)),
            AvgScore=("total_points", lambda x: round(x.mean(), 1)),
        ).reset_index()
        cond_dur.columns = ["Win Condition", "N", "Win Rate %", "Avg Duration (s)", "Avg Score"]
        lines.append(f"**{cls}:**")
        lines.append(df_to_md(cond_dur))
        lines.append("")

    return "\n".join(lines)


# ─── Pattern 6: Out-of-Role Penalty ──────────────────────────────────────────

def p6_out_of_role(df):
    lines = [sep("PATRÓN 6: Penalización por Jugar Fuera de Rol")]

    def bucket_row(label, sub_df, min_n=10):
        n = len(sub_df)
        if n < min_n:
            return None
        return {
            "Situación": label,
            "N": n,
            "Win Rate %": round(sub_df["is_win"].mean() * 100, 1),
            "Avg Score": round(sub_df["total_points"].mean(), 1),
            "Std Score": round(sub_df["total_points"].std(), 1),
        }

    # STRIKER: Deposits
    st = df[df["champ_class"] == "Striker"].copy()

    lines.append(sub("STRIKER — Impacto de hacer o no Deposits"))
    r1 = bucket_row("Con deposits (> 0)", st[st["res_deposits"] > 0])
    r2 = bucket_row("Sin deposits (= 0)", st[st["res_deposits"] == 0])
    if r1 and r2:
        lines.append(table(pd.DataFrame([r1, r2])))
        delta_wr  = round(r1["Win Rate %"] - r2["Win Rate %"], 1)
        delta_sc  = round(r1["Avg Score"]  - r2["Avg Score"],  1)
        lines.append(f"\n> **Delta WR:** {delta_wr:+.1f}% | **Delta Avg Score:** {delta_sc:+.1f} pts")
    lines.append("")

    # Deposits distribution for Strikers
    lines.append(sub("STRIKER — WR y Avg Score por cantidad de Deposits"))
    dep_buckets = []
    for d in [0, 1, 2, 3, 4, 5]:
        sub_d = st[st["res_deposits"] == d]
        if len(sub_d) >= 10:
            dep_buckets.append({
                "Deposits": d, "N": len(sub_d),
                "WR %": round(sub_d["is_win"].mean() * 100, 1),
                "Avg Score": round(sub_d["total_points"].mean(), 1),
                "Std Score": round(sub_d["total_points"].std(), 1),
            })
    sub_d_more = st[st["res_deposits"] >= 6]
    if len(sub_d_more) >= 10:
        dep_buckets.append({
            "Deposits": "6+", "N": len(sub_d_more),
            "WR %": round(sub_d_more["is_win"].mean() * 100, 1),
            "Avg Score": round(sub_d_more["total_points"].mean(), 1),
            "Std Score": round(sub_d_more["total_points"].std(), 1),
        })
    lines.append(table(pd.DataFrame(dep_buckets)))
    lines.append("")

    # DEFENDER: Wart Distance
    def_df = df[df["champ_class"] == "Defender"].copy()

    lines.append(sub("DEFENDER — Impacto del Wart Distance"))
    r1 = bucket_row("Wart distance > 100", def_df[def_df["res_wart_distance"] > 100])
    r2 = bucket_row("Wart distance ≤ 10",  def_df[def_df["res_wart_distance"] <= 10])
    if r1 and r2:
        lines.append(table(pd.DataFrame([r1, r2])))
        delta_wr = round(r1["Win Rate %"] - r2["Win Rate %"], 1)
        delta_sc = round(r1["Avg Score"]  - r2["Avg Score"],  1)
        lines.append(f"\n> **Delta WR:** {delta_wr:+.1f}% | **Delta Avg Score:** {delta_sc:+.1f} pts")
    lines.append("")

    # DEFENDER: Kills
    lines.append(sub("DEFENDER — Impacto de las Eliminaciones"))
    r1 = bucket_row("Eliminaciones ≥ 2", def_df[def_df["res_eliminations"] >= 2])
    r2 = bucket_row("Sin eliminaciones", def_df[def_df["res_eliminations"] == 0])
    if r1 and r2:
        lines.append(table(pd.DataFrame([r1, r2])))
        delta_wr = round(r1["Win Rate %"] - r2["Win Rate %"], 1)
        delta_sc = round(r1["Avg Score"]  - r2["Avg Score"],  1)
        lines.append(f"\n> **Delta WR:** {delta_wr:+.1f}% | **Delta Avg Score:** {delta_sc:+.1f} pts")
    lines.append("")

    # DEFENDER: Wart por rangos
    lines.append(sub("DEFENDER — WR y Avg Score por rango de Wart Distance"))
    wart_buckets = []
    for label, lo, hi in [("0", 0, 1), ("1–50", 1, 50), ("51–150", 50, 150),
                          ("151–300", 150, 300), ("301–500", 300, 500), (">500", 500, 1e9)]:
        sub_w = def_df[(def_df["res_wart_distance"] >= lo) & (def_df["res_wart_distance"] < hi)]
        if len(sub_w) >= 10:
            wart_buckets.append({
                "Wart Range": label, "N": len(sub_w),
                "WR %": round(sub_w["is_win"].mean() * 100, 1),
                "Avg Score": round(sub_w["total_points"].mean(), 1),
            })
    lines.append(table(pd.DataFrame(wart_buckets)))
    lines.append("")

    return "\n".join(lines)

# ─── Pattern 7: Moki ID Matchmaking Bias ─────────────────────────────────────

def p7_matchmaking_bias(df):
    lines = [sep("PATRÓN 7: Sesgo de Matchmaking por Moki ID (análisis de bloques)")]

    # Sort by date
    df2 = df.copy()
    df2["match_date"] = pd.to_datetime(df2["match_date"], errors="coerce")
    df2 = df2.sort_values("match_date").reset_index(drop=True)

    n_blocks = len(df2) // BLOCK_SIZE
    if n_blocks < 2:
        lines.append("_No hay suficientes bloques para el análisis._\n")
        return "\n".join(lines)

    lines.append(f"> Bloques detectados: {n_blocks} × {BLOCK_SIZE} rows = {n_blocks * BLOCK_SIZE:,} matches")
    lines.append("")

    # Count how many times each (champ_id, enemy_id) pair appears
    pair_counts = defaultdict(int)
    champ_block_appearances = defaultdict(set)  # moki_id → set of block_nums

    for i in range(n_blocks):
        block = df2.iloc[i * BLOCK_SIZE : (i + 1) * BLOCK_SIZE]
        for _, row in block[["moki_token_id", "enemy_champ_token_id"]].dropna().iterrows():
            champ  = int(row["moki_token_id"])
            enemy  = int(row["enemy_champ_token_id"])
            if champ == 0 or enemy == 0:
                continue
            pair_key = (min(champ, enemy), max(champ, enemy))
            pair_counts[pair_key] += 1
            champ_block_appearances[champ].add(i)

    lines.append(sub("Pares de Moki que se enfrentan con mayor frecuencia"))
    top_pairs = sorted(pair_counts.items(), key=lambda x: x[1], reverse=True)[:30]
    rows = [{"Moki A": a, "Moki B": b, "Encuentros": cnt} for (a, b), cnt in top_pairs]
    lines.append(table(pd.DataFrame(rows)))
    lines.append("")

    # Distribution
    counts_array = np.array(list(pair_counts.values()))
    lines.append(sub("Distribución de frecuencia de enfrentamientos"))
    lines.append(f"| Métrica | Valor |")
    lines.append(f"|---|---|")
    lines.append(f"| Pares únicos | {len(pair_counts):,} |")
    lines.append(f"| Promedio de encuentros | {counts_array.mean():.2f} |")
    lines.append(f"| Máximo encuentros (un par) | {counts_array.max()} |")
    lines.append(f"| Pares que se enfrentan ≥3 veces | {(counts_array >= 3).sum():,} |")
    lines.append(f"| Pares que se enfrentan ≥5 veces | {(counts_array >= 5).sum():,} |")
    lines.append("")

    # Champions with most diverse block appearances (spread across many blocks)
    lines.append(sub("Mokis con mayor variedad de bloques (alta exposición)"))
    diverse = sorted(
        [(mid, len(blocks)) for mid, blocks in champ_block_appearances.items()],
        key=lambda x: x[1], reverse=True
    )[:20]
    rows = [{"Moki ID": mid, "Bloques únicos con presencia": n} for mid, n in diverse]
    lines.append(table(pd.DataFrame(rows)))
    lines.append("")

    return "\n".join(lines)

# ─── Pattern 8: Performance Variance ─────────────────────────────────────────

def p8_performance_variance(df):
    lines = [sep("PATRÓN 8: Varianza de Performance por Moki ID")]

    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        var_df = sub_df.groupby("moki_token_id").agg(
            Matches=("total_points", "count"),
            Avg=("total_points", "mean"),
            Std=("total_points", "std"),
            WR=("is_win", "mean"),
        ).reset_index()
        var_df = var_df[var_df["Matches"] >= MIN_MATCHES]
        var_df["CV"] = (var_df["Std"] / var_df["Avg"]).round(3)  # Coefficient of variation
        var_df["Avg"] = var_df["Avg"].round(1)
        var_df["Std"] = var_df["Std"].round(1)
        var_df["WR"]  = (var_df["WR"] * 100).round(1)

        top_var    = var_df.sort_values("Std", ascending=False).head(20)
        stable     = var_df.sort_values("Std").head(20)
        top_var.columns = ["Moki ID", "Matches", "Avg Score", "Std Dev", "Win Rate %", "CV"]
        stable.columns   = ["Moki ID", "Matches", "Avg Score", "Std Dev", "Win Rate %", "CV"]

        lines.append(sub(f"{cls} — Top 20 Mokis con MAYOR varianza (inconsistentes)"))
        lines.append(table(top_var))
        lines.append("")
        lines.append(sub(f"{cls} — Top 20 Mokis con MENOR varianza (consistentes)"))
        lines.append(table(stable))
        lines.append("")

    return "\n".join(lines)

# ─── Pattern 9: Buff Time & Wart Ride Correlation ────────────────────────────

def p9_buff_wart_correlation(df):
    lines = [sep("PATRÓN 9: Correlaciones de Buff Time y Wart Ride con Victorias")]

    cols_to_test = [
        ("res_wart_ride_seconds", "Wart Ride Seconds"),
        ("res_buff_time_seconds", "Buff Time Seconds"),
        ("res_wart_closer",       "Wart Closer"),
        ("res_wart_distance",     "Wart Distance"),
    ]

    for cls in ["Striker", "Defender", None]:
        label = cls if cls else "All Classes"
        sub_df = df[df["champ_class"] == cls] if cls else df
        if len(sub_df) < 100:
            continue

        lines.append(sub(f"Clase: {label} (n={len(sub_df):,})"))
        lines.append("| Feature | Corr. con Win | p-value | Interpretación |")
        lines.append("|---|---|---|---|")

        for col, col_label in cols_to_test:
            if col not in sub_df.columns:
                continue
            vals = sub_df[col].fillna(0).astype(float)
            wins = sub_df["is_win"].astype(int)
            try:
                corr, pval = stats.pointbiserialr(vals, wins)
                interp = "✅ Positiva" if corr > 0.05 and pval < 0.05 \
                    else ("🔴 Negativa" if corr < -0.05 and pval < 0.05 \
                    else "⚪ Neutral")
                lines.append(f"| {col_label} | {corr:.4f} | {pval:.4e} | {interp} |")
            except Exception:
                lines.append(f"| {col_label} | N/A | N/A | Error |")

        lines.append("")

    # Mean values for winners vs losers
    lines.append(sub("Valores medios de Buff/Wart para Ganadores vs Perdedores"))
    for cls in ["Striker", "Defender"]:
        sub_df = df[df["champ_class"] == cls]
        lines.append(f"\n**{cls}:**\n")
        for col, col_label in cols_to_test:
            if col not in sub_df.columns:
                continue
            win_mean  = sub_df[sub_df["is_win"] == 1][col].fillna(0).mean()
            loss_mean = sub_df[sub_df["is_win"] == 0][col].fillna(0).mean()
            lines.append(f"- {col_label}: Win={win_mean:.3f} | Loss={loss_mean:.3f} | Delta={win_mean - loss_mean:+.3f}")

    lines.append("")
    return "\n".join(lines)

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)

    print("[INFO] Loading data...")
    df = load_data()

    print("[INFO] Running Pattern 1: Win Condition Distribution...")
    section1 = p1_win_condition_distribution(df)

    print("[INFO] Running Pattern 2: Matchup Win Rate...")
    section2 = p2_matchup_winrate(df)

    print("[INFO] Running Pattern 3: Team Comp Win Rate...")
    section3 = p3_team_comp_winrate(df)

    print("[INFO] Running Pattern 4: Companion Synergies...")
    section4 = p4_companion_synergies(df)

    print("[INFO] Running Pattern 5: Duration vs Outcome...")
    section5 = p5_duration_outcome(df)

    print("[INFO] Running Pattern 6: Out-of-Role Penalty...")
    section6 = p6_out_of_role(df)

    print("[INFO] Running Pattern 7: Matchmaking Bias...")
    section7 = p7_matchmaking_bias(df)

    print("[INFO] Running Pattern 8: Performance Variance...")
    section8 = p8_performance_variance(df)

    print("[INFO] Running Pattern 9: Buff/Wart Correlation...")
    section9 = p9_buff_wart_correlation(df)

    # ── Assemble Report ────────────────────────────────────────────────────────
    header = f"""# Grand Arena — Pattern Discovery Report

**Dataset:** `{INPUT_PATH.name}`  
**Total Rows:** {len(df):,}  
**Date Range:** {df['match_date'].min()} → {df['match_date'].max()}  
**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}  

---

> Este reporte analiza automáticamente los patrones estadísticos del historial de matches.
> Se usa para identificar dónde el modelo es fuerte/débil y qué features son más relevantes para V3.

---
"""

    full_report = header + "\n".join([
        section1, section2, section3, section4,
        section5, section6, section7, section8, section9,
    ])

    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(full_report)

    print(f"\n[OK] Pattern discovery report → {REPORT_PATH}")
    print("[DONE] Bloque 2 complete.")


if __name__ == "__main__":
    main()
