# [LOGIC REPORT] Auto Generador de Lineups

Este documento detalla el funcionamiento interno del generador de lineups basado en el ranking de predicciones de Grand Arena. El código principal reside en `src/utils/lineupGenerator.ts`.

## 1. Entrada de Datos (Inputs)
El generador recibe los siguientes parámetros críticos:
*   **Ranking Data (`MokiRankingRow[]`):** Datos provenientes del ML (Score, WinRate, Wart Closer, etc.).
*   **Contest Config:** Configuración del torneo (rareza permitida, número de slots).
*   **User Cards:** Inventario del usuario (si se usa el modo "MY CARDS").
*   **Upcoming Matches:** Datos de los próximos enfrentamientos para detectar conflictos de matchups.

---

## 2. Fórmulas de Puntaje (Scoring Logic)

El generador calcula un **Effective Score** para cada Moki dependiendo del "Scheme" (estrategia) que se esté evaluando.

### Multiplicadores de Rareza
```typescript
Basic: 1.0
Rare: 1.25
Epic: 1.5
Legendary: 1.75
```

### Fórmulas por Estrategia
Calculadas en la función `calcEffective`:

| Estrategia | Fórmula de Puntaje Efectiva |
| :--- | :--- |
| **Trait / Fur** | `(Base Score * Multiplicador) + 1000` |
| **Touching The Wart** | `(Base Score * Multiplicador) + (Wart Closer * 175)` |
| **Taking A Dive** | `(Base Score * Multiplicador) + (Losses * 175)` |
| **Collective Specialization** | `((Gacha Pts + (WinRate / 10) * 300) * Multiplicador) + (Gacha Pts * 0.5)` |
| **One-Of-Each** | `(Base Score * Multiplicador) + 1450` |

---

## 3. Lógica Paso a Paso (Algoritmo)

El proceso de generación sigue este flujo lógico:

### Paso 1: Construcción del Pool (`buildPool`)
*   Se filtran los Strikers si la opción está activa.
*   Se determina la mejor rareza disponible para cada Moki.
    *   **Modo ALL:** Se usa la rareza máxima permitida por el torneo.
    *   **Modo USER:** Se busca la rareza más alta que el usuario posea dentro del rango del torneo.
*   Se extraen las imágenes del `catalog.json` para las rarezas seleccionadas.

### Paso 2: Detección de Conflictos (`buildConflictSet`)
*   Se analiza la lista de `upcomingMatches`.
*   Si dos Mokis del pool van a enfrentarse entre sí en el torneo real, se marcan como "en conflicto".
*   *Lógica:* El generador evitará poner a Moki A y Moki B en el mismo lineup si están en conflicto (si la opción `avoidMatchupConflicts` está activa).

### Paso 3: Fase 1 - Esquemas de Trait / Fur
*   El código recorre todos los esquemas (ej: Whale Watching, Divine Intervention).
*   Filtra los Mokis que cumplen con el Trait o Fur requerido (ej: Fur "Shadow").
*   **Selección Greedy:** Ordena por Puntaje Efectivo y toma los mejores 4 que no tengan conflictos entre sí ni con nombres ya usados.
*   **Score Cut (Mandatorio):** La suma de los `Base Score` originales de los 4 Mokis debe ser `>= 14,000`. Si es menor, el lineup se descarta.

### Paso 4: Fase 2 - Esquemas Relegated
*   Evalúa esquemas especiales: **Wart** (Wart Closer), **Dive** (Losses), **Gacha** (Puntos Gacha).
*   Toma Mokis que no fueron usados en la Fase 1 (para maximizar variedad).
*   **Score Cut (Mandatorio):** El `Total Effective Score` del lineup debe ser `>= 18,000`.

### Paso 5: Manejo de Torneos "One-Of-Each"
*   Detecta si el torneo requiere exactamente un Moki de cada rareza (Basic, Rare, Epic, Legendary).
*   En este caso, ignora las fases 1 y 2 y usa un generador especializado que reserva slots por rareza y selecciona el mejor Moki disponible para cada "hueco" sin repetir nombres.

### Paso 6: Consolidación y Repeticiones
*   Se juntan todos los lineups válidos.
*   Se ordenan por `Total Effective Score` de mayor a menor.
*   Si el usuario permitió repetidos, el generador clona los mejores lineups basándose en la cantidad de copias que el usuario tenga (o el límite `maxRepeated`).

---

## 4. Resumen de Reglas Críticas en el Código

> [!IMPORTANT]
> **Conflicto de Matchups:** `groupHasConflict` asegura que si Moki A pelea contra Moki B, no aparezcan juntos.
> **Prioridad de Rareza:** `bestRarityWithinConstraint` siempre apunta a lo más alto permitido para maximizar el multiplicador.
> **Cortes de Puntaje:** Los valores **14,000** (Trait/Fur) y **18,000** (Relegated) actúan como filtros de calidad mínimos para que el lineup sea sugerido.
