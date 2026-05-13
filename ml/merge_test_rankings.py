import pandas as pd
from pathlib import Path
import os
import glob

# ID del contest (puede cambiarse o pasarse como argumento, usamos el último que pusiste)
TARGET_CONTEST_ID = "69f94d0b70a1510f6a0dc0c5"

def main():
    data_dir = Path(__file__).parent / "data"
    
    # Rutas de los 3 archivos generados
    v1_path = data_dir / f"ranking_api_contest_{TARGET_CONTEST_ID}.csv"
    v2_str_path = data_dir / f"v2_ranking_striker_api_{TARGET_CONTEST_ID}.csv"
    v2_def_path = data_dir / f"v2_ranking_defender_api_{TARGET_CONTEST_ID}.csv"
    
    if not v1_path.exists():
        print(f"[ERROR] No se encontró el archivo V1: {v1_path}")
        return

    # 1. Cargar V1 (es la base porque tiene TODOS los mokis)
    df_v1 = pd.read_csv(v1_path)
    df_v1 = df_v1.rename(columns={"Score": "V1 Score", "WinRate": "V1 WinRate"})
    
    # 2. Cargar V2 Striker (si existe)
    df_v2_str = pd.DataFrame()
    if v2_str_path.exists():
        df_v2_str = pd.read_csv(v2_str_path)
    
    # 3. Cargar V2 Defender (si existe)
    df_v2_def = pd.DataFrame()
    if v2_def_path.exists():
        df_v2_def = pd.read_csv(v2_def_path)
        
    # Unir V2 Striker y V2 Defender en un solo DataFrame de V2
    df_v2 = pd.concat([df_v2_str, df_v2_def], ignore_index=True)
    
    # Mapear los scores y winrates de V2 por Moki ID
    v2_score_map = {}
    v2_wr_map = {}
    
    if not df_v2.empty:
        # Asegurarnos de que no haya duplicados (un Moki no puede ser Striker y Defender a la vez)
        df_v2 = df_v2.drop_duplicates(subset=["Moki ID"])
        v2_score_map = dict(zip(df_v2["Moki ID"], df_v2["V2 Score"]))
        v2_wr_map = dict(zip(df_v2["Moki ID"], df_v2["V2 WinRate"]))

    # 4. Calcular el V3 (Merged) Score y WinRate
    merged_results = []
    
    for _, row in df_v1.iterrows():
        moki_id = row["Moki ID"]
        v1_score = row["V1 Score"]
        v1_wr = row["V1 WinRate"]
        
        # Si el Moki tiene V2, se promedia. Si no (ej: es un Bruiser), se queda con el V1.
        if moki_id in v2_score_map:
            v2_score = v2_score_map[moki_id]
            v2_wr = v2_wr_map[moki_id]
            merged_score = (v1_score + v2_score) / 2
            merged_wr = (v1_wr + v2_wr) / 2
            has_v2 = True
        else:
            v2_score = None
            v2_wr = None
            merged_score = v1_score
            merged_wr = v1_wr
            has_v2 = False
            
        merged_results.append({
            "Moki ID": moki_id,
            "Name": row.get("Name", ""),
            "Class": row.get("Class", ""),
            "Merged Score": round(merged_score, 1),
            "Merged WinRate": round(merged_wr, 1),
            "V1 Score": round(v1_score, 1),
            "V2 Score": round(v2_score, 1) if has_v2 else "-",
            "Matches": row.get("Matches", 0),
            "Fur": row.get("Fur", ""),
            "Traits": row.get("Traits", "")
        })

    # 5. Crear el DataFrame final y ordenarlo por el Merged Score
    df_merged = pd.DataFrame(merged_results)
    df_merged = df_merged.sort_values("Merged Score", ascending=False)
    
    # 6. Guardar el archivo
    out_path = data_dir / f"merged_ranking_api_contest_{TARGET_CONTEST_ID}.csv"
    df_merged.to_csv(out_path, index=False, encoding="utf-8-sig")
    
    print(f"\n[OK] Ranking V3 (Merge) guardado en: {out_path}")
    print(df_merged.head(10).to_string(index=False))

if __name__ == "__main__":
    main()
