# Grand Arena — Pattern Discovery Report

**Dataset:** `processed_matches.csv`  
**Total Rows:** 121,080  
**Date Range:** 2026-04-06 → 2026-04-30  
**Generated:** 2026-05-04 14:22  

---

> Este reporte analiza automáticamente los patrones estadísticos del historial de matches.
> Se usa para identificar dónde el modelo es fuerte/débil y qué features son más relevantes para V3.

---

════════════════════════════════════════════════════════════
  PATRÓN 1: Distribución de Condiciones de Victoria por Clase
════════════════════════════════════════════════════════════


## Clase: Striker (n=52,802)

| Condición | Total | % del total | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|---|
| elimination | 26661 | 50.5 | 41.0 | 290.7 | 151.8 |
| gacha | 15364 | 29.1 | 62.3 | 344.4 | 126.3 |
| wart | 10777 | 20.4 | 12.5 | 219.6 | 108.1 |


## Clase: Defender (n=55,836)

| Condición | Total | % del total | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|---|
| elimination | 38947 | 69.8 | 55.2 | 271.6 | 172.4 |
| wart | 12220 | 21.9 | 83.5 | 411.6 | 171.3 |
| gacha | 4669 | 8.4 | 14.4 | 193.8 | 114.1 |


════════════════════════════════════════════════════════════
  PATRÓN 2: Win Rate por Matchup (champ_class vs enemy_champ_class)
════════════════════════════════════════════════════════════


## Striker vs Enemy Classes

| Enemy Class | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Striker | 22753 | 50.0 | 314.3 | 142.5 |
| Flanker | 895 | 45.7 | 307.5 | 149.4 |
| Forward | 874 | 42.7 | 296.6 | 148.2 |
| Center | 1080 | 40.1 | 290.8 | 144.4 |
| Support | 451 | 40.1 | 284.5 | 138.4 |
| Bruiser | 2208 | 38.0 | 281.1 | 144.5 |
| Defender | 24492 | 33.5 | 271.4 | 140.3 |


## Defender vs Enemy Classes

| Enemy Class | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Striker | 24450 | 66.5 | 328.8 | 169.5 |
| Support | 442 | 62.0 | 305.4 | 177.9 |
| Forward | 951 | 58.8 | 302.8 | 181.2 |
| Center | 1129 | 57.1 | 292.4 | 184.9 |
| Flanker | 919 | 56.0 | 290.1 | 183.6 |
| Bruiser | 2287 | 55.7 | 289.1 | 186.6 |
| Defender | 25638 | 50.0 | 264.7 | 183.6 |


## Tabla Cruzada: Win Rate por Matchup (todas las clases)

| champ_class | Anchor | Bruiser | Center | Defender | Flanker | Forward | Grinder | Sprinter | Striker | Support |
|---|---|---|---|---|---|---|---|---|---|---|
| Bruiser | 50.0 | 49.7 | 50.9 | 44.3 | 50.0 | 53.4 | 100.0 | 75.0 | 61.9 | 61.9 |
| Center | 0.0 | 50.5 | 48.9 | 43.0 | 53.7 | 52.3 | 100.0 | 100.0 | 59.8 | 52.0 |
| Defender | 100.0 | 55.7 | 57.1 | 50.0 | 56.0 | 58.8 | 57.1 | 55.6 | 66.5 | 62.0 |
| Flanker | - | 48.8 | 43.9 | 43.5 | 53.8 | 35.1 | 100.0 | - | 54.5 | 35.3 |
| Forward | 100.0 | 47.1 | 47.6 | 41.3 | 64.9 | 50.0 | 100.0 | 0.0 | 57.0 | 60.0 |
| Striker | 41.2 | 38.0 | 40.1 | 33.5 | 45.7 | 42.7 | 42.9 | 66.7 | 50.0 | 40.1 |
| Support | - | 41.0 | 50.0 | 37.9 | 65.0 | 37.5 | 0.0 | - | 60.9 | 42.9 |


════════════════════════════════════════════════════════════
  PATRÓN 3: Win Rate por Composición de Equipo (team_comp)
════════════════════════════════════════════════════════════


## Striker — Top/Bottom Composiciones (n≥50)

**Top 15 WR:**
| Team Comp | Matches | Win Rate % | Avg Score |
|---|---|---|---|
| STRIKER_CENTER_CENTER | 342 | 53.5 | 369.6 |
| STRIKER_BRUISER_BRUISER | 1046 | 52.8 | 374.5 |
| STRIKER_BRUISER_CENTER | 1170 | 49.9 | 369.8 |
| STRIKER_CENTER_FLANKER | 723 | 48.3 | 339.9 |
| STRIKER_BRUISER_GRINDER | 1274 | 48.0 | 336.0 |
| STRIKER_BRUISER_FORWARD | 1299 | 47.5 | 341.4 |
| STRIKER_BRUISER_FLANKER | 1215 | 47.3 | 340.8 |
| STRIKER_CENTER_GRINDER | 761 | 46.3 | 330.4 |
| STRIKER_ANCHOR_FORWARD | 701 | 45.9 | 318.8 |
| STRIKER_BRUISER_DEFENDER | 1524 | 45.8 | 331.3 |
| STRIKER_ANCHOR_BRUISER | 1152 | 45.8 | 338.5 |
| STRIKER_CENTER_DEFENDER | 874 | 45.0 | 336.5 |
| STRIKER_CENTER_FORWARD | 759 | 44.5 | 333.1 |
| STRIKER_FLANKER_FLANKER | 384 | 44.5 | 321.0 |
| STRIKER_BRUISER_SUPPORT | 1264 | 44.4 | 297.1 |

**Bottom 15 WR:**
| Team Comp | Matches | Win Rate % | Avg Score |
|---|---|---|---|
| STRIKER_SUPPORT_SUPPORT | 446 | 33.0 | 224.0 |
| STRIKER_STRIKER_SUPPORT | 1441 | 33.4 | 223.9 |
| STRIKER_DEFENDER_STRIKER | 1716 | 34.9 | 249.8 |
| STRIKER_DEFENDER_SPRINTER | 1079 | 35.1 | 254.5 |
| STRIKER_DEFENDER_SUPPORT | 923 | 35.5 | 255.5 |
| STRIKER_SPRINTER_SUPPORT | 939 | 35.7 | 234.9 |
| STRIKER_GRINDER_SUPPORT | 839 | 36.5 | 257.9 |
| STRIKER_SPRINTER_STRIKER | 1630 | 36.7 | 233.6 |
| STRIKER_ANCHOR_SUPPORT | 744 | 37.1 | 270.7 |
| STRIKER_DEFENDER_FORWARD | 880 | 37.2 | 294.5 |
| STRIKER_STRIKER_STRIKER | 1260 | 37.6 | 227.2 |
| STRIKER_ANCHOR_ANCHOR | 319 | 37.6 | 307.0 |
| STRIKER_FLANKER_STRIKER | 1455 | 37.7 | 265.1 |
| STRIKER_FLANKER_SUPPORT | 814 | 37.8 | 267.5 |
| STRIKER_CENTER_SUPPORT | 750 | 38.0 | 280.9 |


## Defender — Top/Bottom Composiciones (n≥50)

**Top 15 WR:**
| Team Comp | Matches | Win Rate % | Avg Score |
|---|---|---|---|
| DEFENDER_BRUISER_CENTER | 1326 | 66.9 | 325.3 |
| DEFENDER_BRUISER_BRUISER | 1029 | 65.3 | 329.1 |
| DEFENDER_BRUISER_GRINDER | 1289 | 64.8 | 329.3 |
| DEFENDER_CENTER_GRINDER | 789 | 64.4 | 321.6 |
| DEFENDER_BRUISER_SPRINTER | 1502 | 63.5 | 301.6 |
| DEFENDER_FORWARD_SPRINTER | 942 | 62.7 | 299.7 |
| DEFENDER_BRUISER_STRIKER | 2458 | 62.4 | 311.7 |
| DEFENDER_GRINDER_SPRINTER | 926 | 62.0 | 292.4 |
| DEFENDER_BRUISER_DEFENDER | 1610 | 61.9 | 311.9 |
| DEFENDER_BRUISER_FORWARD | 1350 | 61.2 | 308.6 |
| DEFENDER_ANCHOR_BRUISER | 1152 | 61.1 | 310.0 |
| DEFENDER_GRINDER_GRINDER | 396 | 60.9 | 323.3 |
| DEFENDER_SPRINTER_SPRINTER | 547 | 60.5 | 279.0 |
| DEFENDER_CENTER_SPRINTER | 897 | 60.5 | 285.0 |
| DEFENDER_BRUISER_FLANKER | 1323 | 60.1 | 305.2 |

**Bottom 15 WR:**
| Team Comp | Matches | Win Rate % | Avg Score |
|---|---|---|---|
| DEFENDER_FLANKER_SUPPORT | 881 | 47.2 | 260.2 |
| DEFENDER_DEFENDER_SUPPORT | 972 | 49.1 | 263.6 |
| DEFENDER_SUPPORT_SUPPORT | 471 | 49.3 | 259.6 |
| DEFENDER_ANCHOR_SUPPORT | 767 | 50.2 | 272.5 |
| DEFENDER_CENTER_SUPPORT | 791 | 50.8 | 276.7 |
| DEFENDER_FORWARD_SUPPORT | 858 | 50.8 | 273.1 |
| DEFENDER_STRIKER_SUPPORT | 1506 | 52.7 | 277.7 |
| DEFENDER_FLANKER_STRIKER | 1533 | 54.3 | 287.0 |
| DEFENDER_GRINDER_SUPPORT | 892 | 54.3 | 290.7 |
| DEFENDER_ANCHOR_CENTER | 731 | 54.4 | 286.3 |
| DEFENDER_DEFENDER_FLANKER | 936 | 54.5 | 283.0 |
| DEFENDER_ANCHOR_FLANKER | 724 | 55.5 | 298.8 |
| DEFENDER_FLANKER_FLANKER | 409 | 55.7 | 298.3 |
| DEFENDER_FORWARD_STRIKER | 1471 | 55.9 | 294.0 |
| DEFENDER_SPRINTER_SUPPORT | 936 | 56.2 | 275.6 |


════════════════════════════════════════════════════════════
  PATRÓN 4: Sinergias de Companions (Ally Pair Win Rate)
════════════════════════════════════════════════════════════


## Striker — Mejores y Peores Pares de Allies (n≥50) — ordenado por Avg Score

**Top 15 pares:**
| Ally Pair | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Bruiser_Bruiser | 1046 | 52.8 | 374.5 | 131.2 |
| Bruiser_Center | 1170 | 49.9 | 369.8 | 134.2 |
| Center_Center | 342 | 53.5 | 369.6 | 141.4 |
| Bruiser_Forward | 1299 | 47.5 | 341.4 | 139.4 |
| Bruiser_Flanker | 1215 | 47.3 | 340.8 | 141.2 |
| Center_Flanker | 723 | 48.3 | 339.9 | 140.9 |
| Anchor_Bruiser | 1152 | 45.8 | 338.5 | 135.5 |
| Center_Defender | 874 | 45.0 | 336.5 | 139.1 |
| Bruiser_Grinder | 1274 | 48.0 | 336.0 | 139.8 |
| Center_Forward | 759 | 44.5 | 333.1 | 142.9 |
| Bruiser_Defender | 1524 | 45.8 | 331.3 | 141.7 |
| Center_Grinder | 761 | 46.3 | 330.4 | 141.4 |
| Anchor_Center | 617 | 43.1 | 325.7 | 144.8 |
| Flanker_Flanker | 384 | 44.5 | 321.0 | 145.0 |
| Anchor_Forward | 701 | 45.9 | 318.8 | 142.0 |

**Bottom 15 pares:**
| Ally Pair | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Striker_Support | 1441 | 33.4 | 223.9 | 127.5 |
| Support_Support | 446 | 33.0 | 224.0 | 131.4 |
| Striker_Striker | 1260 | 37.6 | 227.2 | 126.1 |
| Sprinter_Striker | 1630 | 36.7 | 233.6 | 134.4 |
| Sprinter_Support | 939 | 35.7 | 234.9 | 135.6 |
| Sprinter_Sprinter | 526 | 38.8 | 249.3 | 141.8 |
| Defender_Striker | 1716 | 34.9 | 249.8 | 134.4 |
| Defender_Sprinter | 1079 | 35.1 | 254.5 | 140.4 |
| Defender_Support | 923 | 35.5 | 255.5 | 139.5 |
| Grinder_Support | 839 | 36.5 | 257.9 | 133.9 |
| Grinder_Striker | 1464 | 40.2 | 262.5 | 132.7 |
| Flanker_Striker | 1455 | 37.7 | 265.1 | 135.8 |
| Grinder_Sprinter | 909 | 39.9 | 266.5 | 141.9 |
| Flanker_Support | 814 | 37.8 | 267.5 | 141.5 |
| Anchor_Support | 744 | 37.1 | 270.7 | 137.3 |


## Striker — WR y Avg Score por Ally 1 individual

| Ally Class | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Bruiser | 12439 | 46.1 | 325.2 | 141.7 |
| Center | 6245 | 43.4 | 314.9 | 142.6 |
| Anchor | 7926 | 41.7 | 301.1 | 142.0 |
| Forward | 4345 | 41.5 | 290.6 | 140.7 |
| Flanker | 5015 | 39.9 | 285.0 | 141.0 |
| Defender | 7014 | 37.5 | 274.7 | 141.7 |
| Grinder | 3576 | 39.6 | 266.2 | 136.5 |
| Sprinter | 3095 | 36.7 | 236.6 | 136.2 |
| Striker | 2701 | 35.4 | 225.4 | 126.8 |
| Support | 446 | 33.0 | 224.0 | 131.4 |


## Defender — Mejores y Peores Pares de Allies (n≥50) — ordenado por Avg Score

**Top 15 pares:**
| Ally Pair | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Bruiser_Grinder | 1289 | 64.8 | 329.3 | 171.1 |
| Bruiser_Bruiser | 1029 | 65.3 | 329.1 | 173.2 |
| Bruiser_Center | 1326 | 66.9 | 325.3 | 172.8 |
| Grinder_Grinder | 396 | 60.9 | 323.3 | 175.0 |
| Center_Grinder | 789 | 64.4 | 321.6 | 177.4 |
| Bruiser_Defender | 1610 | 61.9 | 311.9 | 176.8 |
| Bruiser_Striker | 2458 | 62.4 | 311.7 | 175.1 |
| Anchor_Anchor | 312 | 59.0 | 310.9 | 187.6 |
| Anchor_Bruiser | 1152 | 61.1 | 310.0 | 175.5 |
| Bruiser_Forward | 1350 | 61.2 | 308.6 | 175.9 |
| Anchor_Forward | 727 | 56.9 | 307.7 | 188.4 |
| Bruiser_Flanker | 1323 | 60.1 | 305.2 | 175.9 |
| Anchor_Grinder | 736 | 56.5 | 305.1 | 176.7 |
| Flanker_Grinder | 844 | 57.1 | 301.8 | 186.3 |
| Bruiser_Sprinter | 1502 | 63.5 | 301.6 | 175.1 |

**Bottom 15 pares:**
| Ally Pair | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Support_Support | 471 | 49.3 | 259.6 | 188.2 |
| Flanker_Support | 881 | 47.2 | 260.2 | 186.4 |
| Defender_Support | 972 | 49.1 | 263.6 | 180.9 |
| Anchor_Support | 767 | 50.2 | 272.5 | 185.8 |
| Forward_Support | 858 | 50.8 | 273.1 | 184.6 |
| Sprinter_Striker | 1640 | 57.4 | 275.2 | 180.8 |
| Sprinter_Support | 936 | 56.2 | 275.6 | 182.8 |
| Center_Support | 791 | 50.8 | 276.7 | 190.4 |
| Striker_Support | 1506 | 52.7 | 277.7 | 181.1 |
| Defender_Sprinter | 1129 | 57.0 | 278.7 | 179.4 |
| Sprinter_Sprinter | 547 | 60.5 | 279.0 | 183.1 |
| Anchor_Sprinter | 882 | 57.7 | 281.3 | 183.3 |
| Defender_Flanker | 936 | 54.5 | 283.0 | 181.4 |
| Flanker_Sprinter | 908 | 57.5 | 283.3 | 182.3 |
| Center_Sprinter | 897 | 60.5 | 285.0 | 174.7 |


## Defender — WR y Avg Score por Ally 1 individual

| Ally Class | Matches | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Bruiser | 13204 | 62.7 | 312.6 | 175.3 |
| Anchor | 8305 | 56.7 | 296.9 | 182.3 |
| Grinder | 3723 | 57.9 | 296.4 | 179.8 |
| Center | 6708 | 58.3 | 296.0 | 180.3 |
| Forward | 4510 | 56.9 | 291.7 | 179.4 |
| Defender | 7492 | 55.5 | 287.3 | 179.9 |
| Striker | 2874 | 55.6 | 286.6 | 181.3 |
| Flanker | 5426 | 54.8 | 286.5 | 184.3 |
| Sprinter | 3123 | 57.6 | 276.0 | 181.8 |
| Support | 471 | 49.3 | 259.6 | 188.2 |


════════════════════════════════════════════════════════════
  PATRÓN 5: Duración de Partida vs Resultado y Tipo de Victoria
════════════════════════════════════════════════════════════

> ⚠️ **Nota metodológica:** El dataset tiene exactamente 1 fila ganadora y 1 perdedora
> por match (el champion vs el enemy champion). Analizar el WR global por cuartil
> de duración **siempre da 50%** por construcción. El análisis útil es *por clase*
> y *por tipo de victoria*, que sí revelan patrones reales.


## Duración promedio por resultado — POR CLASE

| Clase | Resultado | Mean (s) | Median (s) | Std Dev | N |
|---|---|---|---|---|---|
| Striker | Victoria | 44.14 | 43.56 | 9.46 | 21841 |
| Striker | Derrota | 44.18 | 43.37 | 9.09 | 30961 |
| Defender | Victoria | 46.04 | 45.55 | 8.78 | 32368 |
| Defender | Derrota | 46.72 | 46.37 | 8.79 | 23468 |


## Duración promedio por tipo de victoria

| Win Condition | Mean (s) | Median (s) | N Matches |
|---|---|---|---|
| gacha | 40.46 | 39.97 | 21964 |
| wart | 41.84 | 40.78 | 25171 |
| elimination | 48.09 | 47.54 | 73945 |


## Correlación: duración ↔ victoria (por clase)

> r > 0: partidas más largas → más victorias para esa clase
> r < 0: partidas más cortas → más victorias para esa clase

**Striker** — r=-0.0017, p=0.6893 (⚪ no significativa)
**Defender** — r=-0.0379, p=0.0000 (✅ significativa)


## Win Rate por rango de duración absoluto (Striker y Defender)

> Aquí sí hay señal real porque filtramos por clase antes de calcular WR.

**Striker:**
| Rango | N | Win Rate % | Avg Score |
|---|---|---|---|
| < 30s | 2378 | 58.4 | 290.8 |
| 30-40s | 15943 | 38.5 | 264.5 |
| 40-50s | 20981 | 41.2 | 294.2 |
| 50-60s | 10668 | 41.7 | 315.2 |
| 60-75s | 2768 | 42.7 | 340.9 |
| > 75s | 64 | 46.9 | 382.2 |

**Defender:**
| Rango | N | Win Rate % | Avg Score |
|---|---|---|---|
| < 30s | 646 | 24.8 | 203.0 |
| 30-40s | 13313 | 63.3 | 317.1 |
| 40-50s | 23686 | 57.4 | 283.2 |
| 50-60s | 14314 | 56.1 | 295.5 |
| 60-75s | 3806 | 55.6 | 314.6 |
| > 75s | 71 | 57.7 | 353.8 |


## Win Rate por tipo de victoria Y rango de duración

**Striker:**
| Win Condition | N | Win Rate % | Avg Duration (s) | Avg Score |
|---|---|---|---|---|
| elimination | 26661 | 41.0 | 47.6 | 290.7 |
| gacha | 15364 | 62.3 | 39.9 | 344.4 |
| wart | 10777 | 12.5 | 41.7 | 219.6 |

**Defender:**
| Win Condition | N | Win Rate % | Avg Duration (s) | Avg Score |
|---|---|---|---|---|
| elimination | 38947 | 55.2 | 48.3 | 271.6 |
| gacha | 4669 | 14.4 | 41.8 | 193.8 |
| wart | 12220 | 83.5 | 41.7 | 411.6 |


════════════════════════════════════════════════════════════
  PATRÓN 6: Penalización por Jugar Fuera de Rol
════════════════════════════════════════════════════════════


## STRIKER — Impacto de hacer o no Deposits

| Situación | N | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Con deposits (> 0) | 45596 | 38.9 | 297.6 | 137.0 |
| Sin deposits (= 0) | 7206 | 56.9 | 255.5 | 173.8 |

> **Delta WR:** -18.0% | **Delta Avg Score:** +42.1 pts


## STRIKER — WR y Avg Score por cantidad de Deposits

| Deposits | N | WR % | Avg Score | Std Score |
|---|---|---|---|---|
| 0 | 7206 | 56.9 | 255.5 | 173.8 |
| 1 | 1324 | 40.8 | 209.8 | 165.9 |
| 2 | 2804 | 13.8 | 132.8 | 81.6 |
| 3 | 8938 | 19.5 | 189.7 | 80.6 |
| 4 | 12371 | 31.7 | 263.7 | 93.6 |
| 5 | 10728 | 54.0 | 358.2 | 99.9 |
| 6+ | 9431 | 56.8 | 436.7 | 103.2 |


## DEFENDER — Impacto del Wart Distance

| Situación | N | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Wart distance > 100 | 32995 | 62.9 | 343.8 | 167.9 |
| Wart distance ≤ 10 | 20237 | 53.0 | 239.3 | 175.5 |

> **Delta WR:** +9.9% | **Delta Avg Score:** +104.5 pts


## DEFENDER — Impacto de las Eliminaciones

| Situación | N | Win Rate % | Avg Score | Std Score |
|---|---|---|---|---|
| Eliminaciones ≥ 2 | 10939 | 75.6 | 418.3 | 140.9 |
| Sin eliminaciones | 32178 | 51.0 | 247.1 | 177.4 |

> **Delta WR:** +24.6% | **Delta Avg Score:** +171.2 pts


## DEFENDER — WR y Avg Score por rango de Wart Distance

| Wart Range | N | WR % | Avg Score |
|---|---|---|---|
| 0 | 20010 | 53.1 | 240.2 |
| 1–50 | 1489 | 31.4 | 117.6 |
| 51–150 | 3150 | 37.4 | 159.0 |
| 151–300 | 10851 | 33.3 | 207.3 |
| 301–500 | 8618 | 65.3 | 353.8 |
| >500 | 11718 | 92.6 | 489.2 |


════════════════════════════════════════════════════════════
  PATRÓN 7: Sesgo de Matchmaking por Moki ID (análisis de bloques)
════════════════════════════════════════════════════════════

> Bloques detectados: 50 × 2400 rows = 120,000 matches


## Pares de Moki que se enfrentan con mayor frecuencia

| Moki A | Moki B | Encuentros |
|---|---|---|
| 3340 | 7691 | 8 |
| 3340 | 7405 | 8 |
| 3340 | 7360 | 8 |
| 3340 | 8180 | 8 |
| 3340 | 6913 | 8 |
| 3340 | 6824 | 8 |
| 3340 | 6820 | 8 |
| 3340 | 6769 | 8 |
| 3320 | 7338 | 8 |
| 3320 | 6882 | 8 |
| 3320 | 6821 | 8 |
| 3320 | 6777 | 8 |
| 3320 | 6191 | 8 |
| 3340 | 6221 | 8 |
| 3432 | 6191 | 8 |
| 3563 | 8411 | 8 |
| 3563 | 8316 | 8 |
| 3563 | 8260 | 8 |
| 3563 | 8097 | 8 |
| 3563 | 8044 | 8 |


## Distribución de frecuencia de enfrentamientos

| Métrica | Valor |
|---|---|
| Pares únicos | 29,069 |
| Promedio de encuentros | 4.13 |
| Máximo encuentros (un par) | 8 |
| Pares que se enfrentan ≥3 veces | 17,542 |
| Pares que se enfrentan ≥5 veces | 12,458 |


## Mokis con mayor variedad de bloques (alta exposición)

| Moki ID | Bloques únicos con presencia |
|---|---|
| 6014 | 49 |
| 818 | 47 |
| 3145 | 46 |
| 807 | 46 |
| 984 | 46 |
| 6025 | 46 |
| 6820 | 46 |
| 857 | 45 |
| 6882 | 45 |
| 6824 | 45 |
| 1418 | 44 |
| 1444 | 44 |
| 5690 | 44 |
| 7181 | 44 |
| 2288 | 43 |
| 1454 | 43 |
| 6913 | 43 |
| 3672 | 42 |
| 2661 | 42 |
| 670 | 42 |


════════════════════════════════════════════════════════════
  PATRÓN 8: Varianza de Performance por Moki ID
════════════════════════════════════════════════════════════


## Striker — Top 20 Mokis con MAYOR varianza (inconsistentes)

| Moki ID | Matches | Avg Score | Std Dev | Win Rate % | CV |
|---|---|---|---|---|---|
| 8483.0 | 488.0 | 251.9 | 181.1 | 55.3 | 0.719 |
| 209.0 | 488.0 | 265.0 | 179.8 | 51.6 | 0.679 |
| 888.0 | 488.0 | 252.8 | 175.6 | 44.7 | 0.695 |
| 7555.0 | 488.0 | 251.8 | 174.2 | 50.8 | 0.692 |
| 1628.0 | 488.0 | 268.5 | 169.2 | 51.6 | 0.63 |
| 3624.0 | 510.0 | 278.7 | 165.6 | 46.1 | 0.594 |
| 5710.0 | 510.0 | 280.6 | 164.4 | 54.3 | 0.586 |
| 1175.0 | 488.0 | 277.9 | 164.2 | 45.9 | 0.591 |
| 6154.0 | 488.0 | 261.0 | 161.5 | 46.1 | 0.619 |
| 818.0 | 510.0 | 272.5 | 159.6 | 53.1 | 0.586 |
| 1440.0 | 488.0 | 292.4 | 159.2 | 52.0 | 0.545 |
| 6009.0 | 510.0 | 281.0 | 155.5 | 51.0 | 0.553 |
| 4813.0 | 510.0 | 277.0 | 154.9 | 51.6 | 0.559 |
| 3080.0 | 510.0 | 292.7 | 154.6 | 45.7 | 0.528 |
| 1055.0 | 510.0 | 285.5 | 154.5 | 49.6 | 0.541 |
| 467.0 | 510.0 | 275.4 | 154.1 | 38.0 | 0.56 |
| 3847.0 | 510.0 | 285.0 | 152.4 | 52.0 | 0.535 |
| 8044.0 | 510.0 | 289.1 | 152.4 | 52.7 | 0.527 |
| 2284.0 | 510.0 | 269.3 | 151.3 | 46.7 | 0.562 |
| 3527.0 | 510.0 | 283.1 | 151.0 | 47.1 | 0.534 |


## Striker — Top 20 Mokis con MENOR varianza (consistentes)

| Moki ID | Matches | Avg Score | Std Dev | Win Rate % | CV |
|---|---|---|---|---|---|
| 8587.0 | 510.0 | 303.3 | 128.6 | 37.6 | 0.424 |
| 7958.0 | 510.0 | 301.7 | 129.1 | 35.3 | 0.428 |
| 6777.0 | 510.0 | 293.2 | 130.3 | 36.5 | 0.444 |
| 4642.0 | 510.0 | 285.1 | 131.1 | 35.5 | 0.46 |
| 1361.0 | 488.0 | 307.0 | 131.2 | 40.6 | 0.427 |
| 4434.0 | 510.0 | 291.4 | 131.7 | 37.1 | 0.452 |
| 2288.0 | 510.0 | 309.7 | 132.3 | 41.0 | 0.427 |
| 4258.0 | 510.0 | 303.7 | 132.4 | 39.4 | 0.436 |
| 4081.0 | 488.0 | 293.7 | 132.5 | 34.0 | 0.451 |
| 8223.0 | 488.0 | 307.6 | 132.6 | 40.8 | 0.431 |
| 5044.0 | 488.0 | 290.0 | 132.7 | 34.2 | 0.458 |
| 4509.0 | 510.0 | 295.5 | 133.1 | 36.9 | 0.45 |
| 3841.0 | 510.0 | 288.0 | 133.2 | 33.7 | 0.462 |
| 939.0 | 510.0 | 299.5 | 133.6 | 37.5 | 0.446 |
| 6942.0 | 488.0 | 305.4 | 133.8 | 42.2 | 0.438 |
| 2906.0 | 510.0 | 299.3 | 134.1 | 37.1 | 0.448 |
| 7181.0 | 510.0 | 304.5 | 134.5 | 39.0 | 0.442 |
| 73.0 | 510.0 | 288.8 | 134.7 | 33.9 | 0.467 |
| 8579.0 | 510.0 | 297.2 | 134.8 | 40.0 | 0.454 |
| 6602.0 | 510.0 | 289.6 | 134.9 | 38.8 | 0.466 |


## Defender — Top 20 Mokis con MAYOR varianza (inconsistentes)

| Moki ID | Matches | Avg Score | Std Dev | Win Rate % | CV |
|---|---|---|---|---|---|
| 3484.0 | 488.0 | 288.0 | 201.4 | 56.1 | 0.699 |
| 8887.0 | 510.0 | 296.9 | 196.8 | 54.9 | 0.663 |
| 3849.0 | 488.0 | 265.9 | 193.7 | 52.5 | 0.728 |
| 6536.0 | 510.0 | 294.3 | 190.9 | 62.0 | 0.649 |
| 200.0 | 488.0 | 296.4 | 190.4 | 58.0 | 0.643 |
| 4602.0 | 510.0 | 302.5 | 189.4 | 63.7 | 0.626 |
| 1235.0 | 510.0 | 298.6 | 189.1 | 56.9 | 0.633 |
| 2828.0 | 510.0 | 305.0 | 188.8 | 57.8 | 0.619 |
| 6606.0 | 510.0 | 299.4 | 188.8 | 59.6 | 0.631 |
| 4772.0 | 510.0 | 289.7 | 188.6 | 56.9 | 0.651 |
| 7021.0 | 510.0 | 308.9 | 187.4 | 59.6 | 0.607 |
| 6025.0 | 510.0 | 303.6 | 187.0 | 60.6 | 0.616 |
| 8415.0 | 510.0 | 299.7 | 186.4 | 60.2 | 0.622 |
| 5125.0 | 510.0 | 306.5 | 186.3 | 57.1 | 0.608 |
| 987.0 | 510.0 | 308.2 | 185.8 | 60.2 | 0.603 |
| 807.0 | 510.0 | 291.5 | 185.6 | 57.6 | 0.637 |
| 3717.0 | 510.0 | 293.4 | 185.4 | 57.1 | 0.632 |
| 5890.0 | 510.0 | 281.5 | 185.3 | 59.6 | 0.658 |
| 5690.0 | 488.0 | 310.8 | 185.2 | 61.7 | 0.596 |
| 6014.0 | 510.0 | 291.4 | 185.2 | 57.3 | 0.636 |


## Defender — Top 20 Mokis con MENOR varianza (consistentes)

| Moki ID | Matches | Avg Score | Std Dev | Win Rate % | CV |
|---|---|---|---|---|---|
| 798.0 | 488.0 | 245.4 | 129.2 | 37.1 | 0.526 |
| 1861.0 | 488.0 | 273.6 | 152.7 | 48.2 | 0.558 |
| 3145.0 | 510.0 | 273.3 | 152.9 | 48.0 | 0.56 |
| 4315.0 | 488.0 | 278.3 | 154.0 | 49.0 | 0.553 |
| 1095.0 | 510.0 | 266.0 | 155.6 | 48.6 | 0.585 |
| 561.0 | 510.0 | 273.8 | 156.0 | 46.9 | 0.57 |
| 4816.0 | 510.0 | 269.0 | 159.7 | 44.5 | 0.594 |
| 984.0 | 510.0 | 273.5 | 161.2 | 46.5 | 0.589 |
| 1270.0 | 510.0 | 276.2 | 167.3 | 51.0 | 0.606 |
| 4919.0 | 510.0 | 268.5 | 168.9 | 45.9 | 0.629 |
| 6820.0 | 510.0 | 299.0 | 171.9 | 54.1 | 0.575 |
| 368.0 | 510.0 | 305.3 | 172.5 | 60.4 | 0.565 |
| 5960.0 | 510.0 | 297.3 | 175.0 | 56.3 | 0.589 |
| 8530.0 | 510.0 | 285.6 | 175.4 | 55.3 | 0.614 |
| 1600.0 | 510.0 | 297.1 | 175.5 | 59.8 | 0.591 |
| 3015.0 | 510.0 | 306.5 | 175.9 | 63.1 | 0.574 |
| 5110.0 | 510.0 | 295.5 | 175.9 | 57.1 | 0.595 |
| 5374.0 | 488.0 | 287.5 | 176.1 | 58.6 | 0.612 |
| 7302.0 | 510.0 | 304.5 | 176.2 | 59.2 | 0.579 |
| 964.0 | 510.0 | 289.3 | 177.0 | 58.6 | 0.612 |


════════════════════════════════════════════════════════════
  PATRÓN 9: Correlaciones de Buff Time y Wart Ride con Victorias
════════════════════════════════════════════════════════════


## Clase: Striker (n=52,802)

| Feature | Corr. con Win | p-value | Interpretación |
|---|---|---|---|
| Wart Ride Seconds | 0.1483 | 2.6712e-257 | ✅ Positiva |
| Buff Time Seconds | 0.1632 | 5.8500e-312 | ✅ Positiva |
| Wart Closer | 0.0800 | 9.7832e-76 | ✅ Positiva |
| Wart Distance | 0.1491 | 5.1014e-260 | ✅ Positiva |


## Clase: Defender (n=55,836)

| Feature | Corr. con Win | p-value | Interpretación |
|---|---|---|---|
| Wart Ride Seconds | 0.3152 | 0.0000e+00 | ✅ Positiva |
| Buff Time Seconds | 0.1985 | 0.0000e+00 | ✅ Positiva |
| Wart Closer | 0.2508 | 0.0000e+00 | ✅ Positiva |
| Wart Distance | 0.3188 | 0.0000e+00 | ✅ Positiva |


## Clase: All Classes (n=121,080)

| Feature | Corr. con Win | p-value | Interpretación |
|---|---|---|---|
| Wart Ride Seconds | 0.2830 | 0.0000e+00 | ✅ Positiva |
| Buff Time Seconds | 0.2237 | 0.0000e+00 | ✅ Positiva |
| Wart Closer | 0.2252 | 0.0000e+00 | ✅ Positiva |
| Wart Distance | 0.2853 | 0.0000e+00 | ✅ Positiva |


## Valores medios de Buff/Wart para Ganadores vs Perdedores


**Striker:**

- Wart Ride Seconds: Win=2.202 | Loss=0.641 | Delta=+1.561
- Buff Time Seconds: Win=3.241 | Loss=0.920 | Delta=+2.321
- Wart Closer: Win=0.213 | Loss=0.151 | Delta=+0.062
- Wart Distance: Win=42.475 | Loss=12.127 | Delta=+30.348

**Defender:**

- Wart Ride Seconds: Win=14.623 | Loss=7.432 | Delta=+7.191
- Buff Time Seconds: Win=8.878 | Loss=4.056 | Delta=+4.821
- Wart Closer: Win=0.743 | Loss=0.499 | Delta=+0.244
- Wart Distance: Win=290.539 | Loss=145.482 | Delta=+145.057
