import pandas as pd
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

def analyze_elite_schemes():
    print(f"[INFO] Leyendo {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH)
    
    df["match_date"] = pd.to_datetime(df["match_date"])
    df.sort_values(by=["moki_token_id", "match_date"], inplace=True)
    
    results = []
    
    for moki_id, group in df.groupby("moki_token_id"):
        for i in range(0, len(group), 10):
            chunk = group.iloc[i:i+10]
            if len(chunk) < 10:
                continue 
                
            champ_class = chunk.iloc[0]["champ_class"]
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
                
                mod_agg = (200 if win else 0) + (elims * 80 * 1.75)
                block_ev["Aggressive Specialization"] += (mod_agg - orig_score)
                mod_col = (200 if win else 0) + (deposits * 50 * 1.5)
                block_ev["Collective Specialization"] += (mod_col - orig_score)
                
                mod_naughty = orig_score * 2.5 if elims >= 5 else 0
                block_ev["Enforcing the Naughty List"] += (mod_naughty - orig_score)
                
                mod_hoard = orig_score * 2.5 if deposits >= 6 else 0
                block_ev["Gacha Hoarding"] += (mod_hoard - orig_score)
                
            block_ev["champ_class"] = champ_class
            results.append(block_ev)
            
    df_eval = pd.DataFrame(results)
    scheme_cols = [s["name"] for s in SCHEMES]
    
    print("\n" + "="*90)
    print(" 🚀 ML ELITE POTENTIAL: AN\u00c1LISIS DE SCHEMES TOMANDO SOLO TIER S (TOP 5% DE BLOQUES)")
    print("="*90)
    print("Este reporte asume que utilizas tu modelo de Machine Learning para SELECCIONAR")
    print("exclusivamente las composiciones y partidas ultra-eficientes (Top 5%).")
    print("Muestra el límite superior del EV MÁXIMO que podés ordeñarle a un Scheme por Moki.")
    print("="*90)

    for cls in df_eval["champ_class"].unique():
        class_data = df_eval[df_eval["champ_class"] == cls]
        print(f"\n[{cls.upper()}] (Total del pool: {len(class_data)} bloques torneos evaluados)")
        
        elite_ev_items = []
        for scheme in scheme_cols:
            # Sort scores to get the top Tier S (Top 5% of lineups ML would ideally predict)
            sorted_scores = class_data[scheme].sort_values(ascending=False).values
            top_5_percent_idx = max(int(len(sorted_scores) * 0.05), 1)
            elite_avg = sorted_scores[:top_5_percent_idx].mean()
            elite_ev_items.append((scheme, elite_avg))
            
        elite_ev_items.sort(key=lambda x: x[1], reverse=True)
        
        for i, (s_name, val) in enumerate(elite_ev_items[:5]):
            if val > 1000:
                print(f"  {i+1}. {s_name}: {val:+.0f} EV  🔥 (Destruye el Baseline Pasivo)")
            else:
                print(f"  {i+1}. {s_name}: {val:+.0f} EV")

if __name__ == "__main__":
    analyze_elite_schemes()
