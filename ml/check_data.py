import pandas as pd
df = pd.read_csv('data/raw_matches.csv')
print(f'Filas totales  : {len(df):,}')
print(f'Desde          : {df["match_date"].min()}')
print(f'Hasta          : {df["match_date"].max()}')
if 'moki_token_id' in df.columns:
    print(f'Mokis distintos: {df["moki_token_id"].nunique()}')
