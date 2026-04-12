import pandas as pd
import math
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
INPUT_PATH = DATA_DIR / "processed_matches.csv"

SCHEMES = [
    {"id":  1, "name": "Passive (Rainbow, Gold, etc)", "type": "passive", "pts": 1000},
    {"id": 14, "name": "Collect 'Em All (Perfect)",    "type": "passive", "pts": 1400},
    
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

def analyze_schemes():
    print(f"[INFO] Leyendo {INPUT_PATH}...")
    df = pd.read_csv(INPUT_PATH)
    
    # Check variables exist
    cols = df.columns
    
    df["match_date"] = pd.to_datetime(df["match_date"])
    df.sort_values(by=["moki_token_id", "match_date"], inplace=True)
    
    results = []
    block_id_counter = 0
    
    for moki_id, group in df.groupby("moki_token_id"):
        for i in range(0, len(group), 10):
            chunk = group.iloc[i:i+10]
            if len(chunk) < 10:
                continue # We strictly evaluate complete 10-match tournament blocks
                
            champ_class = chunk.iloc[0]["champ_class"]
            block_ev = {s["name"]: 0 for s in SCHEMES}
            
            # Pasivos
            block_ev["Passive (Rainbow, Gold, etc)"] = 1000
            block_ev["Collect 'Em All (Perfect)"] = 1400
            
            # Dinámicos
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
                
                # Base score real de la partida
                orig_score = (200 if win else 0) + (elims * 80) + (deposits * 50) + (math.floor(wart_d / 80) * 40)
                
                # Additives
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
                
                # Modifiers (Calculamos el score mutado y le restamos el score original para ver la VENTAJA/DESVENTAJA NETA)
                # 32
                mod_agg = (200 if win else 0) + (elims * 80 * 1.75)
                block_ev["Aggressive Specialization"] += (mod_agg - orig_score)
                # 33
                mod_col = (200 if win else 0) + (deposits * 50 * 1.5)
                block_ev["Collective Specialization"] += (mod_col - orig_score)
                # 34
                if elims >= 5:
                    mod_naughty = orig_score * 2.5
                else:
                    mod_naughty = 0
                block_ev["Enforcing the Naughty List"] += (mod_naughty - orig_score)
                # 35
                if deposits >= 6:
                    mod_hoard = orig_score * 2.5
                else:
                    mod_hoard = 0
                block_ev["Gacha Hoarding"] += (mod_hoard - orig_score)
                
            block_ev["champ_class"] = champ_class
            block_ev["block_id"] = block_id_counter
            block_id_counter += 1
            results.append(block_ev)
            
    if not results:
        print("[ERROR] No se pudieron agrupar bloques de 10")
        return
        
    df_eval = pd.DataFrame(results)
    
    # Promediar el EV esperado de los 10-match blocks según la clase!
    scheme_cols = [s["name"] for s in SCHEMES]
    avg_ev = df_eval.groupby("champ_class")[scheme_cols].mean()
    
    print("\n" + "="*80)
    print(" 🏆 EXPECTED VALUE (EV) PROMEDIO POR CLASE EN UN CONTEST DE 10 MATCHES")
    print("="*80)
    print("Este reporte indica los puntos NETOS EXTRA que te dará cada Scheme.\nEl límite a batir es lograr +1000 EV usando un lineup Pasivo Genérico.\n")
    
    for cls, row in avg_ev.iterrows():
        print(f"\n[{cls.upper()}] (Analizados {len(df_eval[df_eval['champ_class'] == cls])} bloques)")
        
        # Encontrar el Top 3 Performance para la clase
        ev_items = [(scheme, val) for scheme, val in row.items()]
        ev_items.sort(key=lambda x: x[1], reverse=True)
        
        for i, (s_name, val) in enumerate(ev_items[:5]):
            if val < 1000:
                print(f"  {i+1}. {s_name}: {val:+.0f} EV  (Riesgo: No supera al Baseline Pasivo de 1000)")
            else:
                print(f"  {i+1}. {s_name}: {val:+.0f} EV  (✅ Optimo)")

if __name__ == "__main__":
    analyze_schemes()
