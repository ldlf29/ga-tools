import pandas as pd
import numpy as np
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
INPUT_PATH = DATA_DIR / "processed_matches.csv"

SCHEMES = [
    {"id": 15, "name": "Victory Lap",          "type": "additive"},
    {"id": 16, "name": "Taking a Dive",        "type": "additive"},
    {"id": 17, "name": "Moki Smash",           "type": "additive"},
    {"id": 18, "name": "Grabbing Balls",       "type": "additive"},
    {"id": 19, "name": "Baiting the Trap",     "type": "additive"},
    {"id": 20, "name": "Touching the Wart",    "type": "additive"},
    {"id": 21, "name": "Gacha Gouging",        "type": "additive"},
    {"id": 22, "name": "Cage Match",           "type": "additive"},
    {"id": 23, "name": "Running Interference", "type": "additive"},
    {"id": 24, "name": "Saccing",              "type": "additive"},
    {"id": 25, "name": "Cursed Dinner",        "type": "additive"},
    {"id": 26, "name": "Litter Collection",    "type": "additive"},
    {"id": 27, "name": "Beat the Buzzer",      "type": "additive"},
    {"id": 28, "name": "Final Blow",           "type": "additive"},
    {"id": 29, "name": "Big Game Hunt",        "type": "additive"},
    {"id": 30, "name": "Flexing",              "type": "additive"},
    {"id": 31, "name": "Wart Rodeo",           "type": "additive"},
    {"id": 32, "name": "Aggressive Specialization", "type": "modifier"},
    {"id": 33, "name": "Collective Specialization", "type": "modifier"},
    {"id": 34, "name": "Enforcing the Naughty List","type": "modifier"},
    {"id": 35, "name": "Gacha Hoarding",            "type": "modifier"},
]

def apply_advanced_analytics():
    print(f"[INFO] Leyendo {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH, low_memory=False)
    
    df["match_date"] = pd.to_datetime(df["match_date"])
    df.sort_values(by=["moki_token_id", "match_date"], inplace=True)
    
    results = []
    
    # 1. Agrupar la data real y calcular puntos por bloque de 10 matches
    print("[INFO] Computando historiales en bloques de 10 partidas...")
    for moki_id, group in df.groupby("moki_token_id"):
        for i in range(0, len(group), 10):
            chunk = group.iloc[i:i+10]
            if len(chunk) < 10:
                continue 
                
            champ_class = str(chunk.iloc[0]["champ_class"])
            team_comp = str(chunk.iloc[0]["team_comp"])
            
            # Identify internal primary win condition of the block (what the team achieved most)
            win_conds = chunk[chunk["is_win"] == 1]["win_condition"]
            block_main_condition = win_conds.mode()[0] if not win_conds.empty else "Loss"
            
            block_ev = {s["name"]: 0 for s in SCHEMES}
            
            for _, match in chunk.iterrows():
                win = bool(match.get("is_win", 0))
                elims = int(match.get("res_eliminations", 0) or 0)
                deposits = int(match.get("res_deposits", 0) or 0)
                wart_d = float(match.get("res_wart_distance", 0.0) or 0.0)
                win_cond = str(match.get("win_condition", ""))
                closer = bool(match.get("res_wart_closer", False))
                deaths = int(match.get("res_deaths", 0) or 0)
                eaten = int(match.get("res_eaten_by_wart", 0) or 0)
                eating = int(match.get("res_eating_while_riding", 0) or 0)
                loose = int(match.get("res_loose_ball_pickups", 0) or 0)
                ended = bool(match.get("res_ended_game", False))
                buff = float(match.get("res_buff_time_seconds", 0.0) or 0.0)
                ride = float(match.get("res_wart_ride_seconds", 0.0) or 0.0)
                
                orig_score = (200 if win else 0) + (elims * 80) + (deposits * 50) + (math.floor(wart_d / 80) * 40)
                
                # ADITIVOS
                block_ev["Victory Lap"] += 100 if win else 0
                block_ev["Taking a Dive"] += 175 if not win else 0
                block_ev["Moki Smash"] += 175 if win and win_cond == "Elimination" else 0
                block_ev["Grabbing Balls"] += 175 if win and win_cond == "Gacha" else 0
                block_ev["Baiting the Trap"] += 175 if win and win_cond == "Wart" else 0
                block_ev["Touching the Wart"] += 125 if closer else 0
                block_ev["Gacha Gouging"] += (15 * deposits) + (20 * elims)
                block_ev["Cage Match"] += (40 * elims) + (10 * deposits)
                block_ev["Running Interference"] += 50 * deaths
                block_ev["Saccing"] += 100 * eaten
                block_ev["Cursed Dinner"] += 75 * eating
                block_ev["Litter Collection"] += 75 * loose
                block_ev["Beat the Buzzer"] += 250 if (ended and win_cond == "Gacha") else 0
                block_ev["Final Blow"] += 250 if (ended and win_cond == "Elimination") else 0
                block_ev["Big Game Hunt"] += 250 if (ended and win_cond == "Wart") else 0
                block_ev["Flexing"] += int(3.5 * buff)
                block_ev["Wart Rodeo"] += int(3.5 * ride)
                
                # MODIFICADORES (Diferencia Real Extra Neta)
                block_ev["Aggressive Specialization"] += ((200 if win else 0) + (elims * 80 * 1.75)) - orig_score
                block_ev["Collective Specialization"] += ((200 if win else 0) + (deposits * 50 * 1.5)) - orig_score
                block_ev["Enforcing the Naughty List"] += (orig_score * 2.5 if elims >= 5 else 0) - orig_score
                block_ev["Gacha Hoarding"] += (orig_score * 2.5 if deposits >= 6 else 0) - orig_score
                
            block_ev["champ_class"] = champ_class
            block_ev["team_comp"] = team_comp
            block_ev["win_condition"] = block_main_condition
            results.append(block_ev)
            
    df_eval = pd.DataFrame(results)
    
    print("\n" + "="*85)
    print(" 📊 REPORTE MAESTRO: RENDIMIENTO DE SCHEMES POR COMPOSICIÓN (TIER LIST)")
    print("="*85)
    print("MÉTRICAS: EV Medio, Desvío Estándar (Riesgo), WinRate% vs Pasivos(>1000)")
    print("Filtros: Sólo evaluamos composiciones fuertemente jugadas (>15 participaciones).")
    
    scheme_cols = [s["name"] for s in SCHEMES]
    
    # 2. Agrupar por Composición Específica y Clase
    comp_groups = df_eval.groupby(["champ_class", "team_comp"])
    
    md_output = []
    md_output.append("# 📊 Reporte Maestro: Rendimiento de Schemes por Sinergia\n")
    md_output.append("> **Filtros Aplicados:** Bloques de 10 partidas, M\u00ednimo 15 participaciones por comp.\n")
    md_output.append("| Clase | Formaci\u00f3n | Win Cond Dominante | Bloques | Top Scheme | Eficacia | Tier |\n")
    md_output.append("| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n")

    valid_comps = 0
    detailed_sections = []

    for (cls, comp), data in comp_groups:
        if len(data) < 15: 
            continue
            
        valid_comps += 1
        comp_stats = []
        for scheme in scheme_cols:
            mean_ev = data[scheme].mean()
            std_dev = data[scheme].std()
            reliability_pct = (data[scheme] >= 1000).mean() * 100
            
            comp_stats.append({
                "scheme": scheme,
                "mean_ev": mean_ev,
                "std_dev": std_dev,
                "reliability": reliability_pct
            })
            
        comp_stats.sort(key=lambda x: (x["reliability"], x["mean_ev"]), reverse=True)
        dom_win_cond = data["win_condition"].mode()[0]
        
        # Add to summary table
        top = comp_stats[0]
        tier_label = "⭐ TIER S" if top["reliability"] >= 30.0 else "🟡 TIER A" if top["reliability"] >= 10.0 else "🔴 TIER C"
        md_output.append(f"| {cls} | {comp} | {dom_win_cond} | {len(data)} | {top['scheme']} | {top['reliability']:.1f}% | {tier_label} |\n")

        # Build detailed section
        section = [
            f"### {cls.upper()} - {comp}",
            f"- **Win Cond Dominante:** {dom_win_cond}",
            f"- **Bloques Analizados:** {len(data)}",
            "\n| Scheme | EV Promedio | Riesgo (Std) | Eficacia (>1000) | Tier |",
            "| :--- | :--- | :--- | :--- | :--- |"
        ]
        
        for st in comp_stats[:3]:
            tier = "⭐ TIER S" if st["reliability"] >= 30.0 else "🟡 TIER A" if st["reliability"] >= 10.0 else "🔴 TIER C"
            section.append(f"| {st['scheme']} | {st['mean_ev']:+5.0f} | ±{st['std_dev']:.0f} | {st['reliability']:.1f}% | {tier} |")
        
        detailed_sections.append("\n".join(section) + "\n")

    full_md = "".join(md_output) + "\n---\n\n## 🔍 Análisis Detallado por Formación\n\n" + "\n".join(detailed_sections)
    
    report_path = DATA_DIR / "scheme_tier_list.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(full_md)
        
    print(f"\n[OK] Reporte Markdown generado en: {report_path}")
    print(f"[OK] Analizadas {valid_comps} Composiciones Sinergizadas.")
    
if __name__ == "__main__":
    apply_advanced_analytics()
