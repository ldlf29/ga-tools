# Metodología del Análisis de Schemes (Explicación Extendida)

Este documento detalla cómo se analiza y se calcula el **Valor Esperado (EV)** de los 35 Schemes disponibles en Grand Arena.

El objetivo principal de este análisis es responder a la pregunta: *"Si juego con este Moki (Campeón) en un bloque de 10 partidas de un Contest, ¿cuántos puntos adicionales me aportará un Scheme específico?"*

Los 35 Schemes se dividen fundamentalmente en **dos grandes grupos**: los que dependen del desempeño en la partida (Performance) y los que otorgan puntos garantizados por cumplir requisitos pasivos (Traits/Rarities).

---

## GRUPO 1: Trait & Rarity Schemes (14 Schemes Pasivos)

Estos Schemes **NO** dependen de lo que suceda en la partida (no importa si ganas, pierdes, haces kills o deposits). Otorgan puntos **fijos y garantizados** siempre y cuando el lineup (los 4 Champions seleccionados) cumplan con características específicas de sus NFTs o cartas.

Dado que son 100% predecibles, actúan como nuestro **Baseline (Punto de Referencia)**: si logramos armar un lineup perfecto para uno de estos Schemes, obtenemos un puntaje fijo. Un Scheme de Performance del Grupo 2 solo vale la pena si genera *en promedio* más puntos que estos.

**El Baseline estándar:** +25 pts por match, por champion = **+1,000 pts garantizados por bloque de 10 partidas.**

### Lista de los 14 Trait & Rarity Schemes:

1. **Rainbow Riot:** +25 pts por trait Fur - Rainbow.
2. **Golden Shower:** +25 pts por trait Fur - Gold.
3. **Midnight Strike:** +25 pts por trait Fur - Shadow.
4. **Divine Intervention:** +25 pts por trait Fur - Spirit.
5. **Whale Watching:** +25 pts por trait Moki 1 of 1 (cualquiera).
6. **Call to Arms:** +25 pts por traits Ronin/Samurai (fondos, ropa, accesorios).
7. **Dungaree Duel:** +25 pts por ropa Pink/Blue/Green Overalls.
8. **Shapeshifting:** +25 pts por máscaras (Tanuki, Kitsune, Cat) o Tongue out.
9. **Malicious Intent:** +25 pts por máscaras (Oni, Tengu, Skull) o Devious mouth.
10. **Housekeeping:** +25 pts por delantales (Artist, Maid) o tacho basura/papel higiénico.
11. **Tear Jerking:** +25 pts por ojos Crying.
12. **Costume Party:** +25 pts por trajes de animales (Onesies) o cabezas frutales/animales.
13. **Dress to Impress:** +25 pts por cualquier Kimono.
14. **Collect ‘Em All:** +35 pts por cada Rareza Única de Carta en el lineup (Basic, Rare, Epic, Legendary).

---

## GRUPO 2: Performance Schemes (21 Schemes Activos)

Estos Schemes **SÍ** dependen del resultado y las estadísticas (stats) que logre el Moki Champion (y su equipo de bots) durante la partida. Su rendimiento varía drásticamente según la **Clase** del Moki (Striker, Defender, etc.).

Para evaluar su rentabilidad (EV), el simulador analiza históricas partidas reales. 
Para cada partida, procesa el **Base Score** (Puntos convencionales sin multipliers: Victoria, Kills, Deposits, Wart) y luego simula aplicar uno de los 21 Performance Schemes.

Existen 3 tipos de evaluación para estos 21 Schemes:

### Tipo 2A: Aditivos Directos (16 Schemes)
Suman puntos fijos según hitos precisos en el match.

15. **Victory Lap:** +100 pts si el equipo ganó.
16. **Taking a Dive:** +175 pts si el equipo perdió.
17. **Moki Smash:** +175 pts si se ganó y la partida terminó por Kills.
18. **Grabbing Balls:** +175 pts si se ganó y terminó por Gachas.
19. **Baiting the Trap:** +175 pts si se ganó y terminó por Wart.
20. **Touching the Wart:** +125 pts si la Wart termina del lado favorable al equipo.
2156. **Gacha Gouging:** +15 pts por cada Gacha depositado y +20 pts por cada Kill, logrados SOLO por el Moki Champion. (Sumatoria directa en base a rendimiento del Champion).
57. **Cage Match:** +40 pts por cada Kill y +10 pts por cada Gacha depositado, logrados SOLO por el Moki Champion. (Sumatoria directa).
23. **Running Interference:** +(50 x Muertes/Deaths) que sufra el Moki Champion.
24. **Saccing:** +(100 x Veces comido por Wart) que sufra el Champion.
25. **Cursed Dinner:** +(75 x Veces montado en Wart comiendo un enemigo).
26. **Litter Collection:** +(75 x Bolas sueltas recogidas) por el Champion.
27. **Beat the Buzzer:** +250 pts si este Moki exacto entregó la bola que terminó el juego.
28. **Final Blow:** +250 pts si este Moki exacto hizo la kill que terminó el juego.
29. **Big Game Hunt:** +250 pts si este Moki condujo la Wart a la trampa para ganar.
30. **Flexing:** +3.5 pts por cada segundo que el Champion pasó buffeado (aproximado sin decimales).
31. **Wart Rodeo:** +3.5 pts por cada segundo que el Champion pasó montando la Wart.

### Tipo 2B: Modificadores Individuales ("Replace") (4 Schemes)
Alteran la fórmula del Base Score multiplicando una estadística fuerte, o aplicando un multiplicador general de victoria, y condicionando los puntos generados por otras fuentes.
*La métrica calculada es la diferencia neta respecto a no tener el Scheme equipado.*

32. **Aggressive Specialization (Kills x1.75 | 0 pts Gacha/Wart):**
    Magnífico para Bruisers (matan sin recoger bolas). Pésimo y destructivo para Strikers (viven de las bolas).
33. **Collective Specialization (Gacha x1.5 | 0 pts Kills/Wart):**
    Excelente para Strikers o Grinders. Deficiente en Defenders.
34. **Enforcing the Naughty List:** El Moki Champion (SOLO ÉL, de forma individual) debe hacer **>=5 Kills** en la partida. Si no lo logra, la partida vale 0 puntos. Si lo logra, gana multiplicador x2.5 en todos sus puntos base.
    * Extremadamente arriesgado debido al alto requerimiento para un solo Moki. Solo viable en pocos casos de especialistas en daño (ej. Bruisers).
35. **Gacha Hoarding:** El Moki Champion (SOLO ÉL, de forma individual) debe depositar **>=6 Gachas** en la partida. Si no, 0 puntos. Si lo logra, gana multiplicador x2.5 en sus puntos base.
    * Altamente restrictivo. Solo viable en Strikers/Grinders que depositan muchas bolas sistemáticamente.

---

## 3. Dinámica del Simulador: Agrupación en Bloques de 10

Dado que los torneos se basan en bloques de 10 entradas y existen muchas fluctuaciones, la simulación de Python agrupa las partidas históricas en **bloques cronológicos de 10 por cada Champion**. 

Para cada bloque de 10, suma el rendimiento real que aportó cada Performance Scheme a ese Moki en particular. Luego, se promedian los resultados de todos los bloques según la **Clase** del Campeón.

El resultado final dictamina si vale la pena arriesgar el lineup por un *Type 2B: Gacha Hoarding* arriesgado pero potente, o si es matemáticamente superior asegurar los 1000 puntos usando un pasivo *Type 1: Whale Watching*.
