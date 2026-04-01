# [LOGIC REPORT] Arquitectura Detallada y Operación del Generador de Lineups

Este documento proporciona un desglose técnico exhaustivo de los componentes arquitectónicos, las mecánicas de puntuación (Scoring) y los parámetros de control del generador de lineups.

---

## 1. Fórmulas de Puntuación (Scoring Mechanics)

El sistema utiliza dos niveles de puntuación para filtrar y ordenar los candidatos.

### A. Multiplicadores de Rarity (Invariables)
Se aplican al puntaje base (`Base Score`) del ranking para reflejar la ventaja competitiva de las cartas de mayor nivel:
*   **Basic**: `x1.0`
*   **Rare**: `x1.25`
*   **Epic**: `x1.5`
*   **Legendary**: `x1.75`

### B. Cálculo del Effective Score (Ranking Score)
Es el valor final utilizado para ordenar a los Mokis de mejor a peor dentro de cada estrategia.

| Estrategia (Scheme) | Fórmula de Cálculo Completa |
| :--- | :--- |
| **Trait / Fur** | `(Base Score * Multiplicador) + 1,000` |
| **Touching The Wart** | `(Base Score * Multiplicador) + (Wart Closer * 175)` |
| **Taking A Dive** | `(Base Score * Multiplicador) + (Losses * 175)` |
| **Gacha / Collective** | `((Gacha Pts + (WinRate/10)*300) * Multiplicador) + (Gacha Pts * 0.5)` |
| **One-Of-Each** | `(Base Score * Multiplicador) + 1,450` |

### C. Evaluación de Calidad (Validation Score)
Antes de aceptar un lineup, el sistema verifica que cumpla con un estándar mínimo de calidad:
*   **Esquemas Trait/Fur**: El `Base Score` sumado de los 4 Mokis (sin multiplicadores) debe ser `>= 14,000`.
*   **Esquemas Relegated**: El `Validation Score` (Base + Bonos, sin Multiplicadores) debe ser `>= 18,000`.

---

## 2. Configuración del Generador (SETUP PREDICTION Modal)

Cada opción en el modal de generación afecta directamente la lógica de filtrado del pool y la construcción de los lineups.

### A. Card Source (ALL vs MY)
*   **ALL (Simulación)**: El generador asume que tienes acceso a todas las cartas del catálogo. Útil para ver "qué sería lo ideal". El stock por personaje se fija en 1.
*   **MY (Inventario Real)**: El generador solo utiliza cartas que existan en tu inventario (`userCards`). El stock se extrae de tus copias físicas reales.

### B. Allow Repeated (Permitir Repetidos)
*   **Desactivado**: El generador solo producirá lineups únicos (basados en diferentes combinaciones de personajes).
*   **Activado**: Si la cantidad de lineups únicos generados es menor al límite del torneo, el sistema clonará los mejores lineups. **Importante**: Sigue respetando el stock físico. No clonará un lineup si no tienes suficientes cartas físicas para cubrirlo (en modo MY).

### C. Max Repeated (Límite por Personaje)
Define cuántas veces puede aparecer el **mismo personaje** en el total de los lineups generados. Si tienes 10 lineups y pones `Max Repeated: 2`, un Moki X solo podrá aparecer en 2 de ellos.

### D. Exclude Strikers
Filtra y elimina del pool a cualquier Moki cuya clase sea "Striker". Esto previene que se sugieran cartas de ataque en torneos donde no prefieras usarlas.

### E. Avoid Matchup Conflicts
Utiliza la base de datos de combates próximos (`upcomingMatches`). Si Moki A y Moki B tienen un combate programado entre sí, el generador **nunca** los pondrá en el mismo lineup, evitando que tus cartas se resten puntos entre sí.

### F. Use Only My Schemes (Filtrar Estrategias)
Por defecto, el generador evalúa todas las estrategias (Whale Watching, Midnight Strike, etc.). Si activas esta opción, el sistema solo evaluará y generará lineups para las estrategias de las cuales **tengas la carta SCHEME** en tu inventario.

---

## 3. Flujo Lógico de Generación

### Fase 1: Inicialización del Stock Literal
Se crea un mapa de inventario usando la clave `NOMBRE:RAREZA`. Esto garantiza que tus cartas Rare y Epic se cuenten por separado y no se mezclen.

### Fase 2: Aplicación del MaxRarity
Para cada slot, se define cuál es el nivel máximo permitido. El generador filtra el pool y **solo acepta** candidatos que tengan esa rareza exacta. Si el slot pide Epic, el sistema ignorará tus versiones Rare del mismo personaje.

### Fase 3: Construcción Greedy (Codiciosa)
1.  **Ordenamiento**: Se ordenan los candidatos de la fase actual por su `Effective Score`.
2.  **Selección**: Se intentan llenar los 4 slots con los mejores candidatos disponibles que:
    *   Coincidan con la `maxRarity` del slot.
    *   No se repitan (un mismo personaje no puede estar dos veces en el mismo lineup).
    *   Tengan stock disponible (`NAME:RARITY`).
    *   No tengan conflictos de combate (si la opción está activa).
3.  **Consumo**: Si el lineup es válido, se resta **-1** al stock del personaje en esa rareza específica.

### Fase 4: Deduplicación (Fingerprints)
Antes de añadir un lineup a la lista final, se genera una huella dactilar (`Fingerprint`) de los nombres de los 4 personajes. Si ya existe un lineup con esos mismos 4 personajes para ese esquema, se descarta para evitar sugerencias redundantes.
