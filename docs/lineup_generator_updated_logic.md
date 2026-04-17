# [LOGIC REPORT] Auto Lineup Generator (Updated Architecture)

This document provides a comprehensive breakdown of the Auto Lineup Generator's logic, integrating the traditional mechanics with the newly introduced special game modes. It serves as the single source of truth for formulas, constraints, scheme allocations, and UI considerations.

---

## 1. Core Principles & Combinations

The lineup generator operates on a strict taxonomy of contest configurations. A contest's ruleset is built from three layers:

1.  **Base Structure:**
    *   **Normal:** Standard slot requirements (e.g., all slots require 'Rare').
    *   **One Of Each (OOE):** Requires exactly one of each rarity (1 Basic, 1 Rare, 1 Epic, 1 Legendary).
2.  **Special Mode (Mutually Exclusive):** A contest can have **ONLY ONE** special mode active at a time. The modes are: `No Win Bonus`, `Best Objective`, `Median Cap`, `Drop Worst Moki`, `Lowest Score`, and `Class Coverage`.
3.  **Universal Modifier:**
    *   **No Scheme:** Can be applied on top of *any* valid combination. It disables all scheme bonuses and scheme-specific selection logic.

**Valid Combination Examples:**
*   Normal (Base only)
*   Normal + No Scheme
*   One Of Each + Lowest Score
*   Normal + Class Coverage + No Scheme

---

## 2. Rarity Slot Logic

When the generator attempts to fill a slot defined by a contest, it must adhere to strict rarity rules to avoid competitive disadvantages:

*   **Default Behavior:** The generator must **strictly use the `maxRarity`** specified for that slot. It will not fall back to a lower rarity.
*   **Exception - "Lowest Score":** When the "Lowest Score" mode is active, the generator must **strictly use the `minRarity`** specified for that slot.

---

## 3. Game Modes Breakdown & Scoring Formulas

Each mode alters how the `Base Score` of a Moki is calculated before Rarity Multipliers and Scheme Bonuses are applied.

### A. No Win Bonus
Winning is irrelevant; only pure performance matters.
*   **Formula:** `(Deposits × 50) + (Kills × 80) + (Math.floor(Wart Distance / 80) × 40)`

### B. Best Objective
Only the single best-performing metric counts towards the score, heavily favoring specialized Mokis.
*   **Formula:** `MAX((Deposits × 50), (Kills × 80), (Math.floor(Wart Distance / 80) × 40)) + Win Bonus`

### C. Median Cap
Penalizes highly specialized "one-trick pony" Mokis by capping all three objectives at their median value.
*   **Formula:** 
    1. Calculate raw objectives: `S1 = Dep×50`, `S2 = Kills×80`, `S3 = Wart×40`
    2. Find Median (`M`) of `[S1, S2, S3]`
    3. Final Base Score: `Math.min(S1, M) + Math.min(S2, M) + Math.min(S3, M) + Win Bonus`

### D. Drop Worst Moki
The generator builds the absolute strongest 4-Moki lineup using standard greedy logic. During the final lineup score calculation, the score of the lowest-performing Moki in that specific lineup is subtracted from the total.

### E. Lowest Score
The goal is to assemble the worst possible team.
*   **Logic:** Reverses the sorting algorithm (ascending score). Strictly uses `minRarity`. Bypasses standard high-score validation thresholds.
*   **Schemes:** Bypasses normal schemes. Exclusively uses:
    *   `Enforcing The Naughty List` (Forces a lineup of Strikers)
    *   `Gacha Hoarding` (Forces a lineup of Defenders)

### F. Class Coverage
Forces extreme class diversity while maximizing the impact of the strongest classes.
*   **Rules:**
    1.  **Unique Classes:** Every slot must have a different class (no duplicates).
    2.  **Mandatory Classes:** A `STRIKER` and a `DEFENDER` **must** be present in every lineup.
    3.  **Rarity Prioritization:** The slots with the highest rarity limits (e.g., Legendary and Epic in OOE) must be assigned to the Striker and Defender. Lower rarity slots receive the remaining classes (Sprinter, Flanker, etc.).

---

## 4. Scheme Allocation & Restrictions

Scheme selection is heavily dictated by the Base Structure and Special Modes:

*   **One Of Each (OOE):** **Always** uses the `"Collect Em All"` scheme.
    *   *Exception:* If combined with `Lowest Score`, it uses the Lowest Score specific schemes.
    *   *Exception:* If `No Scheme` is active, no scheme is used.
*   **Class Coverage:** **Always** uses `TRAIT / FUR` schemes. Relegated schemes like *Touching The Wart* and *Collective Specialization* are excluded.
    *   *Fallback:* Once Trait/Fur options are exhausted, the system can use the `Taking A Dive` relegated scheme as an alternative (pending threshold logic review).
*   **Lowest Score:** Uses `Enforcing The Naughty List` or `Gacha Hoarding`.
*   **No Scheme Modifier:** Overrides everything. No schemes are evaluated or required.

---

## 5. Thresholds & Validation (Pending Review)

Currently, the generator requires lineups to meet minimum quality thresholds to be presented to the user:
*   **Trait/Fur Schemes:** `Raw Base Sum >= 10,000`
*   **Relegated Schemes:** `Validation Score >= 13,000`

**Adjustments Needed:**
1.  **Lowest Score:** Must completely bypass these minimums. (Consider adding a *maximum* threshold, e.g., `< 5000`).
2.  **Median Cap & No Win Bonus:** Because these modes significantly reduce the average Moki base score, the hardcoded `10,000` / `13,000` thresholds will likely result in 0 lineups generated. These thresholds must be dynamically lowered when these modes are active.
3.  **Class Coverage Fallback:** Need to define the exact score threshold at which a `Taking A Dive` scheme is considered acceptable over a weak `Trait/Fur` scheme.

---

## 6. UI / UX Considerations & Requirements

To prevent user confusion and impossible generations, the Frontend (Setup Modal & UI) needs the following adjustments:

### A. Scheme Selector Disabling
*   If a contest has the `No Scheme` modifier, the "Use Only My Schemes" toggle and the specific scheme dropdown **must be disabled/hidden**.
*   If a contest is `One Of Each` (and not Lowest Score/No Scheme), the dropdown should be locked to `"Collect Em All"`.
*   If a contest is `Lowest Score`, the dropdown should be locked to the specific Naughty List / Gacha Hoarding options.

### B. Displaying "No Scheme" Lineups
*   Currently, lineups display a Scheme Image. For `No Scheme` lineups, we need a default placeholder image (e.g., a "Crossed Out" icon or a generic "Raw Power" icon) and the text "No Scheme Applied".

### C. Visualizing "Drop Worst Moki"
*   In the generated lineup card, the Moki that was calculated as the "worst" and dropped from the total score should be visually distinct (e.g., slightly grayed out, strike-through on its individual score, or a "Dropped" badge) so the user understands why the total score doesn't equal the sum of the 4 cards.

### D. "Lowest Score" UI Cues
*   The sorting of the final generated lineups should be inverted (displaying the absolute lowest scoring lineup at the top of the results). Color coding could shift from Green (Good) to Red/Orange to indicate the goal is being "bad".

---

## 7. Deep Dive: Current Threshold System

Historically, the Lineup Generator used strict hardcoded thresholds (`14,000` for Trait/Fur schemes and `18,000` for Relegated schemes) inside the `buildLineup` function. A lineup that failed to reach these minimum score limits was immediately discarded.

**Current State (Disabled for Debugging):**
As of the latest architecture updates aimed at supporting the new special game modes (Median Cap, No Win Bonus, Lowest Score, etc.), the score threshold enforcement inside `buildLineup` has been **temporarily disabled**. 

*   **Why?** Modes like "Median Cap" mathematically slash the maximum possible score a Moki can achieve. If the hardcoded `14,000` limit were active, a mathematically perfect Median Cap lineup might only score `8,000` and be erroneously discarded, resulting in the user seeing "UNABLE TO GENERATE LINEUPS".
*   **How it works now:** The `scoreMin` parameter is still passed to `buildLineup`, but the actual validation (`if (totalEffectiveScore < scoreMin) return null;`) is commented out. The generator simply builds the absolute best team it can from the available pool using Greedy logic, regardless of the final total.
*   **Next Steps:** We need to re-implement dynamic thresholds that scale based on the active mode (e.g., setting the threshold for Median Cap to `5,000` instead of `14,000`, or inverting it to a *maximum* threshold for Lowest Score).

---

## 8. Deep Dive: Scheme Selection Architecture

The generator iterates through possible schemes and attempts to build valid 4-Moki lineups. It uses a "Pool" system divided into two phases: **Trait/Fur Schemes** and **Relegated (Strategic) Schemes**.

### Scheme Pools
1.  **`traitSchemes`**: Includes schemes based entirely on visual traits (e.g., "Tongue Out") or Fur types (e.g., "Shadow").
2.  **`relegatedSchemes`**: Includes highly specialized mechanical schemes that drastically alter score calculations (e.g., "Touching The Wart", "Taking A Dive", "Collective Specialization").

### The Selection Process (Standard Mode)
The `generateStandard` function manages how many lineups are built for each scheme category to ensure diversity:
1.  **Filtering & Overrides:**
    *   If "Use Only My Schemes" is active, the generator checks the user's inventory (`schemeStockMap`) and trims both `traitSchemes` and `relegatedSchemes` to only include owned cards.
    *   If a specific mode is active, it forcefully overrides the available schemes:
        *   `Lowest Score`: Replaces everything with "Enforcing The Naughty List" and "Gacha Hoarding".
        *   `Class Coverage`: Limits Relegated Schemes to only "Taking A Dive".
        *   `No Scheme`: Clears all schemes and inserts a mock "No Scheme" placeholder.
2.  **Trait Pool Generation (`traitPool`):**
    *   The generator iterates over all available `traitSchemes`.
    *   For each scheme, it filters the available Mokis to ONLY those that possess the required trait/fur (`mokiMatchesScheme`).
    *   It calls `buildLineup` using this restricted pool. If successful, it adds the lineup to the `traitPool` and deducts from the user's stock.
3.  **Relegated Pool Generation (`specPool`):**
    *   Next, it iterates over the `relegatedSchemes`.
    *   Instead of filtering by visual traits, it filters the Moki pool based on performance metrics specific to that scheme's strategy (e.g., for "Taking A Dive", it only looks at Mokis with `losses > 5`).
    *   It generates lineups and adds them to `specPool`.
4.  **Limits & Combination:**
    *   To prevent one scheme from dominating the entire list, there are limits (`SAFETY_LIMIT = 20`). In standard generation, it tries to build up to 20 trait lineups and 20 relegated lineups. 
    *   If `Class Coverage` is active, it strictly balances them (10 Trait / 10 Relegated) to ensure the user gets a 50/50 split of strategies.
    *   Finally, the `traitPool` and `specPool` are merged, sorted by their `totalEffectiveScore`, and sliced down to the user's requested amount (e.g., top 5 lineups).

### The Selection Process (One Of Each Mode)
The "One Of Each" (`generateOneOfEach`) structure is rigid:
*   It explicitly uses the `"Collect Em All"` scheme and ignores the `traitSchemes` / `relegatedSchemes` loop entirely.
*   The generator explicitly loops through the 4 mandatory rarities (`legendary`, `epic`, `rare`, `basic`) and picks the single best Moki for each slot, assembling the lineup.
*   If `Lowest Score` or `No Scheme` are combined with OOE, it will replace "Collect Em All" with the appropriate fallback modifier.