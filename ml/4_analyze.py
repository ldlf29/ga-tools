"""
Script 4 — Analysis & Simulation
Analiza el dataset y permite simular matchups específicos.

Funciones:
    1. WinRate empírico por composición (mínimo 50 partidas)
    2. Feature Importance / SHAP values del clasificador
    3. simulate_matchup(my_comp, enemy_comp) → WinRate + Expected Points

Uso:
    python 4_analyze.py
    python 4_analyze.py --simulate "STRIKER_DEFENDER_GACHA" "RUNNER_HEALER_STRIKER"
"""

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier, CatBoostRegressor, Pool

# ─── Rutas ───────────────────────────────────────────────────────────────────

DATA_DIR = Path(__file__).parent / "data"
MODELS_DIR = Path(__file__).parent / "models"
INPUT_PATH = DATA_DIR / "processed_matches.csv"
METRICS_PATH = DATA_DIR / "model_metrics.json"
CLF_MODEL_PATH = MODELS_DIR / "catboost_classifier.cbm"
REG_MODEL_PATH = MODELS_DIR / "catboost_regressor.cbm"
WINRATE_PATH = DATA_DIR / "empirical_winrates.csv"

FEATURE_COLS: list[str] = [
    "team_comp",
    "enemy_comp",
    "champ_class",
    "ally1_class",
    "ally2_class",
    "enemy_champ_class",
    "enemy_ally1_class",
    "enemy_ally2_class",
    "win_condition",
]

MIN_MATCHES = 50  # Mínimo de partidas para calcular WinRate empírico confiable

# ─── Carga de modelos ─────────────────────────────────────────────────────────


def load_models() -> tuple[CatBoostClassifier, CatBoostRegressor]:
    clf = CatBoostClassifier()
    clf.load_model(str(CLF_MODEL_PATH))

    reg = CatBoostRegressor()
    reg.load_model(str(REG_MODEL_PATH))

    return clf, reg


def load_data() -> pd.DataFrame:
    df = pd.read_csv(INPUT_PATH, low_memory=False)
    for col in FEATURE_COLS:
        if col in df.columns:
            df[col] = df[col].fillna("UNKNOWN").astype(str)
    return df


# ─── 1. WinRate Empírico ──────────────────────────────────────────────────────


def compute_empirical_winrates(df: pd.DataFrame, min_matches: int = MIN_MATCHES) -> pd.DataFrame:
    """
    Calcula el WinRate empírico por team_comp.
    Solo incluye composiciones con >= min_matches partidas.
    """
    grp = (
        df.groupby("team_comp")
        .agg(
            total_matches=("is_win", "count"),
            wins=("is_win", "sum"),
            avg_points=("total_points", "mean"),
        )
        .reset_index()
    )
    grp["win_rate"] = grp["wins"] / grp["total_matches"]
    grp = grp[grp["total_matches"] >= min_matches].copy()
    grp.sort_values("win_rate", ascending=False, inplace=True)
    grp.reset_index(drop=True, inplace=True)
    return grp


def print_top_comps(winrates: pd.DataFrame, top_n: int = 20) -> None:
    print(f"\n{'='*65}")
    print(f"TOP {top_n} COMPOSICIONES (mínimo {MIN_MATCHES} partidas)")
    print(f"{'='*65}")
    print(f"{'#':>3}  {'Composición':<35} {'Partidas':>8} {'WinRate':>8} {'AvgPts':>8}")
    print("-" * 65)
    for i, row in winrates.head(top_n).iterrows():
        print(
            f"{i+1:>3}.  {row['team_comp']:<35} "
            f"{int(row['total_matches']):>8} "
            f"{row['win_rate']:>7.1%} "
            f"{row['avg_points']:>8.1f}"
        )


# ─── 2. Feature Importance & SHAP ────────────────────────────────────────────


def print_feature_importance(
    clf: CatBoostClassifier, reg: CatBoostRegressor
) -> None:
    print(f"\n{'='*50}")
    print("IMPORTANCIA DE FEATURES — Clasificador (WinRate)")
    print(f"{'='*50}")
    imps = clf.get_feature_importance()
    for feat, imp in sorted(zip(FEATURE_COLS, imps), key=lambda x: -x[1]):
        bar = "█" * int(imp / 2)
        print(f"  {feat:30s}: {imp:5.1f} {bar}")

    print(f"\n{'='*50}")
    print("IMPORTANCIA DE FEATURES — Regresor (Expected Points)")
    print(f"{'='*50}")
    imps_r = reg.get_feature_importance()
    for feat, imp in sorted(zip(FEATURE_COLS, imps_r), key=lambda x: -x[1]):
        bar = "█" * int(imp / 2)
        print(f"  {feat:30s}: {imp:5.1f} {bar}")


def compute_shap_values(
    clf: CatBoostClassifier, df: pd.DataFrame, sample_size: int = 500
) -> None:
    """Calcula y muestra SHAP values del clasificador sobre una muestra."""
    print(f"\n{'='*50}")
    print(f"SHAP Values (muestra de {sample_size} filas)")
    print(f"{'='*50}")
    sample = df[FEATURE_COLS].sample(min(sample_size, len(df)), random_state=42)

    # CatBoost tiene soporte nativo para SHAP
    cat_indices = [FEATURE_COLS.index(c) for c in FEATURE_COLS]
    pool = Pool(sample, cat_features=cat_indices)
    shap_values = clf.get_feature_importance(pool, type="ShapValues")
    # shap_values shape: (n_rows, n_features + 1), la última col es base value

    mean_abs_shap = np.abs(shap_values[:, :-1]).mean(axis=0)
    for feat, val in sorted(zip(FEATURE_COLS, mean_abs_shap), key=lambda x: -x[1]):
        print(f"  {feat:30s}: {val:.4f}")


# ─── 3. Simulación de Matchup ─────────────────────────────────────────────────


def _comp_to_row(team_comp: str, enemy_comp: str, win_condition: str = "UNKNOWN") -> dict:
    """
    Convierte strings de composición a un dict de features.
    Asume formato: CHAMP_ALLY1_ALLY2 (ya ordenado).
    """
    my_parts = team_comp.upper().split("_")
    en_parts = enemy_comp.upper().split("_")

    if len(my_parts) < 3 or len(en_parts) < 3:
        raise ValueError(
            "Las composiciones deben tener formato CHAMP_ALLY1_ALLY2. "
            f"Recibido: '{team_comp}' vs '{enemy_comp}'"
        )

    # Ordenar aliados (por si el usuario no lo hizo)
    my_allies = sorted(my_parts[1:3])
    en_allies = sorted(en_parts[1:3])

    return {
        "champ_class": my_parts[0],
        "ally1_class": my_allies[0],
        "ally2_class": my_allies[1],
        "team_comp": f"{my_parts[0]}_{my_allies[0]}_{my_allies[1]}",
        "enemy_champ_class": en_parts[0],
        "enemy_ally1_class": en_allies[0],
        "enemy_ally2_class": en_allies[1],
        "enemy_comp": f"{en_parts[0]}_{en_allies[0]}_{en_allies[1]}",
        "win_condition": win_condition,
    }


def simulate_matchup(
    my_comp: str,
    enemy_comp: str,
    clf: CatBoostClassifier,
    reg: CatBoostRegressor,
    win_condition: str = "UNKNOWN",
) -> dict:
    """
    Predice la Probabilidad de Victoria y el Puntaje Esperado
    para un enfrentamiento específico.

    Args:
        my_comp:       Composición propia, formato "CHAMP_ALLY1_ALLY2"
        enemy_comp:    Composición enemiga, mismo formato
        clf:           Clasificador CatBoost entrenado
        reg:           Regresor CatBoost entrenado
        win_condition: 'Gacha' | 'Wart' | 'Elimination' | 'UNKNOWN'

    Returns:
        dict con 'win_probability' y 'expected_points'
    """
    row = _comp_to_row(my_comp, enemy_comp, win_condition)
    X = pd.DataFrame([row])[FEATURE_COLS]

    # CatBoost acepta strings directamente cuando se cargan con save/load_model
    win_prob = float(clf.predict_proba(X)[0, 1])
    expected_pts = float(reg.predict(X)[0])

    return {
        "my_comp": row["team_comp"],
        "enemy_comp": row["enemy_comp"],
        "win_condition": win_condition,
        "win_probability": round(win_prob, 4),
        "expected_points": round(expected_pts, 1),
    }


def simulate_all_vs_one(
    my_comp: str,
    df: pd.DataFrame,
    clf: CatBoostClassifier,
    reg: CatBoostRegressor,
    top_n: int = 10,
) -> pd.DataFrame:
    """
    Simula mi composición contra todas las composiciones enemigas
    que aparecen en el dataset. Retorna los N mejores y N peores matchups.
    """
    enemy_comps = df["enemy_comp"].unique()
    results = []
    for ec in enemy_comps:
        try:
            result = simulate_matchup(my_comp, ec, clf, reg)
            results.append(result)
        except ValueError:
            continue

    out = pd.DataFrame(results).sort_values("win_probability", ascending=False)
    print(f"\n[SIM] Mi composición: {my_comp}")
    print(f"\nMEJORES {top_n} matchups:")
    print(out.head(top_n).to_string(index=False))
    print(f"\nPEORES {top_n} matchups:")
    print(out.tail(top_n).to_string(index=False))
    return out


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Análisis y simulación de matchups")
    parser.add_argument(
        "--simulate",
        nargs=2,
        metavar=("MY_COMP", "ENEMY_COMP"),
        help="Simula un matchup específico. Formato: CHAMP_ALLY1_ALLY2",
    )
    parser.add_argument(
        "--win-condition",
        default="UNKNOWN",
        help="Condición de victoria: Gacha, Wart, Elimination o UNKNOWN",
    )
    parser.add_argument(
        "--vs-all",
        metavar="MY_COMP",
        help="Simula mi composición contra todas las enemigas del dataset",
    )
    args = parser.parse_args()

    print("[INFO] Cargando modelos...")
    clf, reg = load_models()

    print("[INFO] Cargando dataset procesado...")
    df = load_data()

    # ── WinRate empírico ──────────────────────────────────────────────────────
    winrates = compute_empirical_winrates(df)
    winrates.to_csv(WINRATE_PATH, index=False)
    print(f"[OK] WinRates empíricos guardados: {WINRATE_PATH}")
    print_top_comps(winrates)

    # ── Feature Importance ────────────────────────────────────────────────────
    print_feature_importance(clf, reg)

    # ── SHAP (opcional, puede ser lento) ─────────────────────────────────────
    try:
        compute_shap_values(clf, df)
    except Exception as e:
        print(f"[WARN] No se pudieron calcular SHAP values: {e}")

    # ── Simulaciones ──────────────────────────────────────────────────────────
    if args.simulate:
        my_comp, enemy_comp = args.simulate
        result = simulate_matchup(my_comp, enemy_comp, clf, reg, args.win_condition)
        print(f"\n{'='*50}")
        print("RESULTADO DE LA SIMULACIÓN")
        print(f"{'='*50}")
        for k, v in result.items():
            print(f"  {k:20s}: {v}")

    if args.vs_all:
        simulate_all_vs_one(args.vs_all, df, clf, reg)


if __name__ == "__main__":
    main()
