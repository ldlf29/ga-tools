/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EnhancedCard } from '@/types';
import type { Contest } from '@/types/contest';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScoreType = 'trait-fur' | 'wart' | 'dive' | 'gacha' | 'one-of-each';

export interface MokiRankingRow {
  'Moki ID': number;
  Name: string;
  Class: string;
  Score: number;
  WinRate: number;
  'Wart Closer': number;
  Losses: number;
  'Gacha Pts': number;
  Deaths: number;
  'Win By Combat': number;
  Fur: string;
  Traits: string;
}

export interface MokiCandidate {
  name: string;
  class: string;
  fur: string;
  traits: string;
  baseScore: number;
  losses: number;
  wartCloser: number;
  gachaPts: number;
  winRate: number;
  rarity: string;
  cardImage: string;
  copies: number;
}

export interface GeneratedLineup {
  id: string;
  schemeName: string;
  schemeImage: string;
  schemeType: 'trait-fur' | 'relegated' | 'one-of-each';
  mokis: MokiCandidate[];
  totalBaseScore: number;
  totalEffectiveScore: number;
  hasScheme: boolean;
}

export interface UpcomingMatchData {
  id: string;
  contest_id: string;
  match_date: string;
  team_red: any[];
  team_blue: any[];
  created_at: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  rarity: string;
  image: string;
  market: string;
}

export interface GenerateParams {
  rankingData: MokiRankingRow[];
  catalog: CatalogEntry[];
  userCards: EnhancedCard[];
  cardMode: 'ALL' | 'USER';
  contest: Contest;
  upcomingMatches: UpcomingMatchData[];
  lineupCount: number;
  allowRepeated: boolean;
  maxRepeated: number;
  excludeStrikers: boolean;
  avoidMatchupConflicts: boolean;
  useOnlyMySchemes?: boolean;
  cardSource: 'ALL' | 'MY';
}

// ─── Scheme Definitions ──────────────────────────────────────────────────────

interface SchemeDef {
  name: string;
  image: string;
  type: 'fur' | 'trait';
  values: string[];
}

const TRAIT_FUR_SCHEMES: SchemeDef[] = [
  { name: 'Whale Watching', image: '/scheme/whale watching.webp', type: 'fur', values: ['1 of 1', '1-of-1'] },
  { name: 'Divine Intervention', image: '/scheme/divine intervention.webp', type: 'fur', values: ['Spirit'] },
  { name: 'Midnight Strike', image: '/scheme/midnight strike.webp', type: 'fur', values: ['Shadow'] },
  { name: 'Golden Shower', image: '/scheme/golden shower.webp', type: 'fur', values: ['Gold'] },
  { name: 'Rainbow Riot', image: '/scheme/rainbow riot.webp', type: 'fur', values: ['Rainbow'] },
  { name: 'Shapeshifting', image: '/scheme/shapeshifting.webp', type: 'trait', values: ['Tongue Out', 'Tanuki Mask', 'Kitsune Mask', 'Cat Mask'] },
  { name: 'Tear jerking', image: '/scheme/tear jerking.webp', type: 'trait', values: ['Crying Eye'] },
  { name: 'Costume party', image: '/scheme/costume party.webp', type: 'trait', values: ['Onesie', 'Lemon Head', 'Kappa Head', 'Tomato Head', 'Blob Head'] },
  { name: 'Dress To Impress', image: '/scheme/dress to impress.webp', type: 'trait', values: ['Kimono'] },
  { name: 'Call To Arms', image: '/scheme/call to arms.webp', type: 'trait', values: ['Ronin', 'Samurai', 'Ronin Aurora', 'Ronin Moon'] },
  { name: 'Malicious Intent', image: '/scheme/malicious intent.webp', type: 'trait', values: ['Devious Mouth', 'Oni Mask', 'Tengu Mask', 'Skull Mask', 'Horns', 'TMA Noble Skull'] },
  { name: 'Housekeeping', image: '/scheme/housekeeping.webp', type: 'trait', values: ['Apron', 'Garbage Can', 'Gold Can', 'Toilet Paper'] },
  { name: 'Dungaree Duel', image: '/scheme/dungaree duel.webp', type: 'trait', values: ['Pink Overalls', 'Blue Overalls', 'Green Overalls'] },
];

const RELEGATED_SCHEMES = [
  { name: 'Touching The Wart', image: '/scheme/touching the wart.webp', scoreType: 'wart' as const },
  { name: 'Collective Specialization', image: '/scheme/collective specialization.webp', scoreType: 'gacha' as const },
  { name: 'Taking A Dive', image: '/scheme/taking a dive.webp', scoreType: 'dive' as const },
];

const COLLECT_EM_ALL = { name: "Collect 'Em All", image: "/scheme/collect em all.webp" };

// ─── Rarity Utilities ────────────────────────────────────────────────────────

const RARITY_ORDER = ['basic', 'rare', 'epic', 'legendary'];

function getRarityRank(r: string): number {
  return RARITY_ORDER.indexOf(r.toLowerCase());
}

export function getRarityMultiplier(rarity: string): number {
  switch (rarity.toLowerCase()) {
    case 'basic': return 1.0;
    case 'rare': return 1.25;
    case 'epic': return 1.5;
    case 'legendary': return 1.75;
    default: return 1.0;
  }
}

function meetsRarityConstraint(rarity: string, minRarity: string, maxRarity: string): boolean {
  const rank = getRarityRank(rarity);
  return rank >= getRarityRank(minRarity) && rank <= getRarityRank(maxRarity);
}

function bestRarityWithinConstraint(maxRarity: string): string {
  // Always use the highest rarity up to maxRarity (since all rarities exist in catalog)
  return maxRarity.toLowerCase();
}

// ─── Conflict Utilities ──────────────────────────────────────────────────────

function buildConflictSet(matches: UpcomingMatchData[]): Set<string> {
  const set = new Set<string>();
  for (const match of matches) {
    const red = match.team_red?.[0];
    const blue = match.team_blue?.[0];
    if (!red?.name || !blue?.name) continue;
    const a = String(red.name).toUpperCase();
    const b = String(blue.name).toUpperCase();
    set.add(`${a}|||${b}`);
    set.add(`${b}|||${a}`);
  }
  return set;
}

function hasConflict(nameA: any, nameB: any, conflictSet: Set<string>): boolean {
  return conflictSet.has(`${String(nameA).toUpperCase()}|||${String(nameB).toUpperCase()}`);
}

function groupHasConflict(names: string[], conflictSet: Set<string>): boolean {
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (hasConflict(names[i], names[j], conflictSet)) return true;
    }
  }
  return false;
}

// ─── Catalog Lookup ──────────────────────────────────────────────────────────

type CatalogLookup = Map<string, Map<string, string>>; // name.upper → rarity.lower → imageURL

function buildCatalogLookup(catalog: CatalogEntry[]): CatalogLookup {
  const lookup: CatalogLookup = new Map();
  for (const entry of catalog) {
    const key = String(entry.name).toUpperCase();
    if (!lookup.has(key)) lookup.set(key, new Map());
    lookup.get(key)!.set(String(entry.rarity).toLowerCase(), entry.image);
  }
  return lookup;
}

function getImageFromCatalog(name: any, rarity: string, lookup: CatalogLookup): string {
  return lookup.get(String(name).toUpperCase())?.get(String(rarity).toLowerCase()) ?? '';
}

// ─── MY CARDS Utilities ──────────────────────────────────────────────────────

function getOwnedRarities(name: any, userCards: EnhancedCard[]): { rarity: string; image: string; copies: number }[] {
  const results: { rarity: string; image: string; copies: number }[] = [];
  const mokiCards = userCards.filter(
    c => c.cardType === 'MOKI' && String(c.name).toUpperCase() === String(name).toUpperCase()
  );
  for (const card of mokiCards) {
    results.push({
      rarity: card.rarity.toLowerCase(),
      image: card.image,
      copies: card.stackCount ?? 1,
    });
  }
  return results;
}

function getBestOwnedRarityForSlot(
  name: string,
  maxRarity: string,
  userCards: EnhancedCard[]
): { rarity: string; image: string; copies: number } | null {
  const owned = getOwnedRarities(name, userCards);
  // Strict check: if contest says Epic, and I only have Basic, return null to avoid "weak" fallback.
  const valid = owned.filter(o => o.rarity === maxRarity.toLowerCase());
  if (valid.length === 0) return null;
  
  // Aggregate copies from all items of this rarity
  return {
    rarity: valid[0].rarity,
    image: valid[0].image,
    copies: valid.reduce((sum, o) => sum + o.copies, 0),
  };
}

// ─── Trait Matching ──────────────────────────────────────────────────────────

function hasTrait(traitsStr: string, targets: string[]): boolean {
  if (!traitsStr) return false;
  return targets.some(t => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(traitsStr);
  });
}

function mokiMatchesScheme(moki: any, scheme: SchemeDef): boolean {
  if (scheme.type === 'fur') {
    const furVal = moki.fur !== undefined ? moki.fur : moki.Fur;
    const fur = (String(furVal || '')).toLowerCase().trim();
    return scheme.values.some(v => fur === v.toLowerCase());
  }
  const traitsVal = moki.traits !== undefined ? moki.traits : moki.Traits;
  return hasTrait(String(traitsVal || ''), scheme.values);
}

// ─── Score Calculators ───────────────────────────────────────────────────────

function getSchemeBonus(moki: MokiCandidate, scoreType: ScoreType): number {
  switch (scoreType) {
    case 'wart': return moki.wartCloser * 175;
    case 'dive': return moki.losses * 175;
    case 'gacha': return (moki.gachaPts * 0.5); // The extra bonus part
    case 'one-of-each': return 1450;
    default: return 1000; // Trait/Fur bonus
  }
}

function calcValidationScore(moki: MokiCandidate, scoreType: ScoreType): number {
  // Validation Score: (Base Score) + Bonuses (NO Rarity Multiplier)
  if (scoreType === 'gacha') {
    return (moki.gachaPts + (moki.winRate / 10) * 200) + (moki.gachaPts * 0.5);
  }
  return moki.baseScore + getSchemeBonus(moki, scoreType);
}

function calcRankingScore(moki: MokiCandidate, scoreType: ScoreType): number {
  // Ranking Score (Effective): (Base Score * Multiplier) + Bonuses
  const multiplier = getRarityMultiplier(moki.rarity);
  if (scoreType === 'gacha') {
    return (moki.gachaPts + (moki.winRate / 10) * 200) * multiplier + (moki.gachaPts * 0.5);
  }
  return (moki.baseScore * multiplier) + getSchemeBonus(moki, scoreType);
}

function calcEffective(moki: MokiCandidate, scoreType: ScoreType): number {
  return calcRankingScore(moki, scoreType);
}

function lineupTotalEffective(mokis: MokiCandidate[], scoreType: ScoreType): number {
  return mokis.reduce((sum, m) => sum + calcRankingScore(m, scoreType), 0);
}

function lineupTotalValidation(mokis: MokiCandidate[], scoreType: ScoreType): number {
  return mokis.reduce((sum, m) => sum + calcValidationScore(m, scoreType), 0);
}

function lineupBaseOnly(mokis: MokiCandidate[]): number {
  return mokis.reduce((sum, m) => sum + m.baseScore * getRarityMultiplier(m.rarity), 0);
}

// ─── Pool Builder ────────────────────────────────────────────────────────────

function buildPool(params: GenerateParams, catalogLookup: CatalogLookup): MokiCandidate[] {
  const pool: MokiCandidate[] = [];

  for (const row of params.rankingData) {
    if (params.excludeStrikers && (row.Class || '').toLowerCase() === 'striker') continue;

    const name = row.Name;
    if (!name) continue;

    // Filtro de seguridad: ignorar los 60 Mokis nuevos que no están en el catálogo de cartas
    if (!catalogLookup.has(String(name).toUpperCase())) continue;

    const baseMoki = {
      name,
      class: row.Class || '',
      fur: row.Fur || '',
      traits: row.Traits || '',
      baseScore: typeof row.Score === 'number' ? row.Score : parseFloat(String(row.Score || '0')),
      losses: typeof row.Losses === 'number' ? row.Losses : parseFloat(String(row.Losses || '0')),
      wartCloser: typeof row['Wart Closer'] === 'number' ? row['Wart Closer'] : parseFloat(String(row['Wart Closer'] || '0')),
      gachaPts: typeof row['Gacha Pts'] === 'number' ? row['Gacha Pts'] : parseFloat(String(row['Gacha Pts'] || '0')),
      winRate: typeof row.WinRate === 'number' ? row.WinRate : parseFloat(String(row.WinRate || '0').replace('%', '')),
    };

    if (params.cardMode === 'ALL') {
      // Add all 4 possible rarities to the pool (if in catalog)
      for (const r of RARITY_ORDER) {
        const img = getImageFromCatalog(name, r, catalogLookup);
        if (img) {
          pool.push({ ...baseMoki, rarity: r, cardImage: img, copies: 1 });
        }
      }
    } else {
      // Add all owned rarities to the pool with their specific copy counts
      const owned = getOwnedRarities(name, params.userCards);
      for (const o of owned) {
        pool.push({ ...baseMoki, rarity: o.rarity, cardImage: o.image, copies: o.copies });
      }
    }
  }

  return pool;
}

// ─── Greedy Lineup Builder ───────────────────────────────────────────────────

function buildGreedyLineup(
  candidates: MokiCandidate[],
  usedNames: Set<string>,
  conflictSet: Set<string>,
  avoidConflicts: boolean,
  scoreType: ScoreType,
  slots: any[],
  stockMap: Map<string, number>,
): MokiCandidate[] | null {
  const selected: MokiCandidate[] = [];
  const localUsedNames = new Set<string>();

  for (const slot of slots) {
    const minR = slot.minRarity.toLowerCase();
    const maxR = slot.maxRarity.toLowerCase();

    let foundForSlot = false;

    // Use a secondary loop to pick the best candidate that fits the current slot
    for (const candidate of candidates) {
      const nameKey = String(candidate.name).toUpperCase();
      const stockKey = `${nameKey}:${candidate.rarity.toUpperCase()}`;
      
      if (usedNames.has(nameKey) || localUsedNames.has(nameKey)) continue;
      
      // Stock check: LITERAL check for this specific rarity in the inventory
      if ((stockMap.get(stockKey) ?? 0) <= 0) continue;

      // Verify rarity: LITERAL check to always use the maxRarity allowed for the slot
      if (candidate.rarity.toLowerCase() !== maxR.toLowerCase()) continue;

      if (avoidConflicts && selected.length > 0) {
        if (selected.some(s => hasConflict(candidate.name, s.name, conflictSet))) continue;
      }

      selected.push(candidate);
      localUsedNames.add(nameKey);
      foundForSlot = true;
      break;
    }

    if (!foundForSlot) return null;
  }

  return selected;
}

function getLineupFingerprint(mokis: MokiCandidate[]): string {
  return [...mokis]
    .map(m => String(m.name).toUpperCase())
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function buildLineup(
  candidates: MokiCandidate[],
  usedNames: Set<string>,
  conflictSet: Set<string>,
  avoidConflicts: boolean,
  scoreType: ScoreType,
  slots: any[],
  scoreMin: number,
  schemeName: string,
  schemeImage: string,
  schemeType: 'trait-fur' | 'relegated' | 'one-of-each',
  id: string,
  stockMap: Map<string, number>,
): GeneratedLineup | null {
  const sorted = [...candidates].sort(
    (a, b) => calcRankingScore(b, scoreType) - calcRankingScore(a, scoreType)
  );

  const mokis = buildGreedyLineup(sorted, usedNames, conflictSet, avoidConflicts, scoreType, slots, stockMap);
  if (!mokis) return null;

  if (schemeType === 'trait-fur') {
    const rawSum = mokis.reduce((s, m) => s + m.baseScore, 0);
    // Ajustado al nuevo meta (Promedios de 2600-2700 pts * 4 = 10400)
    if (rawSum < 10000) return null;
  } else if (schemeType === 'relegated') {
    const valScore = lineupTotalValidation(mokis, scoreType);
    // Ajustado al nuevo meta (Base 10400 + 4000 en bonos)
    if (valScore < 13000) return null;
  }

  const totalEffectiveScore = lineupTotalEffective(mokis, scoreType);
  const totalBaseScore = lineupBaseOnly(mokis);

  return { id, schemeName, schemeImage, schemeType, mokis, totalBaseScore, totalEffectiveScore, hasScheme: true };
}

// ─── One-Of-Each Generator ───────────────────────────────────────────────────

function generateOneOfEach(
  pool: MokiCandidate[],
  catalogLookup: CatalogLookup,
  params: GenerateParams,
  conflictSet: Set<string>,
  schemeStockMap: Map<string, number>
): GeneratedLineup[] {
  const stockMap = new Map<string, number>();
  for (const m of pool) {
    const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
    stockMap.set(key, (stockMap.get(key) ?? 0) + m.copies);
  }

  const uniqueLineups: GeneratedLineup[] = [];
  const seenFingerprints = new Set<string>();
  const SAFETY_LIMIT = 100;
  const raritySlots = ['legendary', 'epic', 'rare', 'basic'];

  while (uniqueLineups.length < SAFETY_LIMIT) {
    // If using only my schemes, check if we have "Collect Em All" cards left
    if (params.useOnlyMySchemes) {
      const stock = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
      if (stock <= 0) break;
    }

    const selected: MokiCandidate[] = [];
    const usedNamesInLineup = new Set<string>();

    for (const targetRarity of raritySlots) {
      let slotCandidates: MokiCandidate[] = [];
      
      if (params.cardMode === 'ALL') {
        slotCandidates = pool
          .filter(m => !usedNamesInLineup.has(String(m.name).toUpperCase()))
          .map(m => ({
            ...m,
            rarity: targetRarity,
            cardImage: getImageFromCatalog(String(m.name), targetRarity, catalogLookup),
          }))
          .filter(m => m.cardImage !== '');
      } else {
        for (const row of params.rankingData) {
          const name = String(row.Name).toUpperCase();
          if (usedNamesInLineup.has(name)) continue;
          
          const stockKey = `${name}:${targetRarity.toUpperCase()}`;
          if ((stockMap.get(stockKey) ?? 0) <= 0) continue;
          
          if (params.excludeStrikers && String(row.Class).toLowerCase() === 'striker') continue;

          const ownedEntry = params.userCards.find(
            c => c.cardType === 'MOKI' &&
              String(c.name).toUpperCase() === name &&
              String(c.rarity).toLowerCase() === targetRarity
          );
          if (!ownedEntry) continue;

          slotCandidates.push({
            name: row.Name,
            class: row.Class || '',
            fur: row.Fur || '',
            traits: row.Traits || '',
            baseScore: parseFloat(String(row.Score || '0')),
            losses: parseFloat(String(row.Losses || '0')),
            wartCloser: parseFloat(String(row['Wart Closer'] || '0')),
            gachaPts: parseFloat(String(row['Gacha Pts'] || '0')),
            winRate: parseFloat(String(row.WinRate || '0').replace('%', '')),
            rarity: targetRarity,
            cardImage: ownedEntry.image,
            copies: 1, 
          });
        }
      }

      slotCandidates.sort((a,b) => calcRankingScore(b, 'one-of-each') - calcRankingScore(a, 'one-of-each'));

      let chosen: MokiCandidate | null = null;
      for (const candidate of slotCandidates) {
        if (params.avoidMatchupConflicts && selected.length > 0) {
          if (selected.some(s => hasConflict(candidate.name, s.name, conflictSet))) continue;
        }
        chosen = candidate;
        break;
      }

      if (chosen) {
        selected.push(chosen);
        usedNamesInLineup.add(String(chosen.name).toUpperCase());
      } else {
        break;
      }
    }

    if (selected.length === 4) {
      const valScore = lineupTotalValidation(selected, 'one-of-each');
      if (valScore >= 13000) {
        const fingerprint = getLineupFingerprint(selected);
        if (!seenFingerprints.has(fingerprint)) {
          const totalEffectiveScore = lineupTotalEffective(selected, 'one-of-each');
          const totalBaseScore = lineupBaseOnly(selected);
          
          // Consume "Collect Em All" scheme card stock if it exists
          const current = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
          const hasSchemeCard = current > 0;
          if (hasSchemeCard) {
            schemeStockMap.set(COLLECT_EM_ALL.name.toUpperCase(), current - 1);
          }

          uniqueLineups.push({
            id: `ooe-u-${uniqueLineups.length}`,
            schemeName: COLLECT_EM_ALL.name,
            schemeImage: COLLECT_EM_ALL.image,
            schemeType: 'one-of-each',
            mokis: selected,
            totalBaseScore,
            totalEffectiveScore,
            hasScheme: hasSchemeCard
          });
          seenFingerprints.add(fingerprint);
        }

        selected.forEach(m => {
          const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      } else {
        break;
      }
    } else {
      break;
    }
  }

  const finalResults: GeneratedLineup[] = [...uniqueLineups];
  if (params.allowRepeated && finalResults.length < params.lineupCount) {
    for (const original of uniqueLineups) {
      if (finalResults.length >= params.lineupCount) break;

      const physicalCopies = params.cardMode === 'USER'
        ? Math.min(...original.mokis.map(m => {
            const entry = params.userCards.find(c => String(c.name).toUpperCase() === String(m.name).toUpperCase() && String(c.rarity).toLowerCase() === String(m.rarity).toLowerCase());
            return entry?.stackCount ?? 1;
          }))
        : 999;
      
      const toAdd = Math.min(physicalCopies - 1, params.maxRepeated - 1, params.lineupCount - finalResults.length);
      for (let i = 0; i < toAdd; i++) {
        // Repeated lineups also consume scheme stock if available
        const currentStock = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
        const hasSchemeCard = currentStock > 0;
        if (hasSchemeCard) {
          schemeStockMap.set(COLLECT_EM_ALL.name.toUpperCase(), currentStock - 1);
        }

        finalResults.push({ 
          ...original, 
          id: `${original.id}-rep-${i + 1}`,
          hasScheme: hasSchemeCard
        });
      }
    }
  }

  return finalResults;
}

// ─── Standard Generator ──────────────────────────────────────────────────────

function generateStandard(
  pool: MokiCandidate[],
  params: GenerateParams,
  conflictSet: Set<string>,
  schemeStockMap: Map<string, number>
): GeneratedLineup[] {
  const championSlots = params.contest.lineupConfig.slots.filter(s => s.cardType === 'champion');

  const stockMap = new Map<string, number>();

  for (const m of pool) {
    // LITERAL Rarity Distinction: OneCharacter:OneRarity = One Stock Unit
    const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
    stockMap.set(key, (stockMap.get(key) ?? 0) + m.copies);
  }

  const traitPool: GeneratedLineup[] = [];
  const specPool: GeneratedLineup[] = [];
  const globalSeenFingerprints = new Set<string>();
  const SAFETY_LIMIT = 100;

  let traitSchemes = TRAIT_FUR_SCHEMES;
  let relegatedSchemes = RELEGATED_SCHEMES;

  if (params.useOnlyMySchemes) {
    const ownedSchemeNames = new Set(
      params.userCards
        .filter(c => c.cardType === 'SCHEME')
        .map(c => String(c.name).toUpperCase().trim())
    );
    traitSchemes = TRAIT_FUR_SCHEMES.filter(s => ownedSchemeNames.has(s.name.toUpperCase().trim()));
    relegatedSchemes = RELEGATED_SCHEMES.filter(s => ownedSchemeNames.has(s.name.toUpperCase().trim()));
  }

  const getAvailablePool = () => pool.filter(m => (stockMap.get(`${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`) ?? 0) > 0);

  for (const scheme of traitSchemes) {
    if (traitPool.length + specPool.length >= SAFETY_LIMIT) break;

    let canBuildAnother = true;
    while (canBuildAnother && (traitPool.length + specPool.length < SAFETY_LIMIT)) {
      // Check scheme stock if "Only My Schemes" is on
      if (params.useOnlyMySchemes) {
        if ((schemeStockMap.get(scheme.name.toUpperCase()) ?? 0) <= 0) {
          canBuildAnother = false;
          break;
        }
      }

      const currentPool = getAvailablePool().filter(m => mokiMatchesScheme(m as unknown as MokiRankingRow, scheme));
      const lineup = buildLineup(
        currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
        'trait-fur', championSlots, 14000,
        scheme.name, scheme.image, 'trait-fur', `tf-${scheme.name}-${traitPool.length}`,
        stockMap
      );

      if (lineup) {
        const fingerprint = getLineupFingerprint(lineup.mokis);
        if (!globalSeenFingerprints.has(fingerprint)) {
          const currentStock = schemeStockMap.get(scheme.name.toUpperCase()) ?? 0;
          const hasSchemeCard = currentStock > 0;
          if (hasSchemeCard) {
            schemeStockMap.set(scheme.name.toUpperCase(), currentStock - 1);
          }

          const lineupWithOwnership = { ...lineup, hasScheme: hasSchemeCard };
          traitPool.push(lineupWithOwnership);
          globalSeenFingerprints.add(fingerprint);
        }
        
        lineup.mokis.forEach(m => {
          // ALWAYS consume stock specifically for the Moki:Rarity used
          const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      } else {
        canBuildAnother = false;
      }
    }
  }

  for (const schemeDef of relegatedSchemes) {
    if (traitPool.length + specPool.length >= SAFETY_LIMIT) break;

    if (params.excludeStrikers && (schemeDef.scoreType === 'dive' || schemeDef.scoreType === 'gacha')) continue;

    let canBuildAnother = true;
    while (canBuildAnother && (traitPool.length + specPool.length < SAFETY_LIMIT)) {
      // Check scheme stock if "Only My Schemes" is on
      if (params.useOnlyMySchemes) {
        if ((schemeStockMap.get(schemeDef.name.toUpperCase()) ?? 0) <= 0) {
          canBuildAnother = false;
          break;
        }
      }

      let currentPool = getAvailablePool();
      
      if (schemeDef.scoreType === 'wart') {
        currentPool = currentPool.filter(m => m.wartCloser > 5 && (m.class.toLowerCase() !== 'striker'));
      } else if (schemeDef.scoreType === 'dive') {
        currentPool = currentPool.filter(m => m.losses > 5);
      } else if (schemeDef.scoreType === 'gacha') {
        currentPool = currentPool.filter(m => m.gachaPts > 2000);
      }

      const lineup = buildLineup(
        currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
        schemeDef.scoreType, championSlots, 18000,
        schemeDef.name, schemeDef.image, 'relegated', `rel-${schemeDef.name}-${specPool.length}`,
        stockMap
      );

      if (lineup) {
        const fingerprint = getLineupFingerprint(lineup.mokis);
        if (!globalSeenFingerprints.has(fingerprint)) {
          const currentStock = schemeStockMap.get(schemeDef.name.toUpperCase()) ?? 0;
          const hasSchemeCard = currentStock > 0;
          if (hasSchemeCard) {
            schemeStockMap.set(schemeDef.name.toUpperCase(), currentStock - 1);
          }

          const lineupWithOwnership = { ...lineup, hasScheme: hasSchemeCard };
          specPool.push(lineupWithOwnership);
          globalSeenFingerprints.add(fingerprint);
        }
        
        lineup.mokis.forEach(m => {
          // ALWAYS consume stock specifically for the Moki:Rarity used
          const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      } else {
        canBuildAnother = false;
      }
    }
  }

  traitPool.sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);
  specPool.sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);

  const uniqueMasterList = [...traitPool, ...specPool].sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);

  const finalResults: GeneratedLineup[] = [];
  
  for (const lineup of uniqueMasterList) {
    finalResults.push({ ...lineup, id: `${lineup.id}-unique` });
  }

  if (params.allowRepeated && finalResults.length < params.lineupCount) {
    for (const original of uniqueMasterList) {
      if (finalResults.length >= params.lineupCount) break;

      const physicalCopies = params.cardMode === 'USER'
        ? Math.min(...original.mokis.map(m => {
            const entry = params.userCards.find(c => String(c.name).toUpperCase() === String(m.name).toUpperCase() && String(c.rarity).toLowerCase() === String(m.rarity).toLowerCase());
            return entry?.stackCount ?? 1;
          }))
        : 999;
      
      const remainingToAdd = Math.min(physicalCopies - 1, params.maxRepeated - 1, params.lineupCount - finalResults.length);

      for (let i = 0; i < remainingToAdd; i++) {
        const currentStock = schemeStockMap.get(original.schemeName.toUpperCase()) ?? 0;
        const hasSchemeCard = currentStock > 0;
        if (hasSchemeCard) {
          schemeStockMap.set(original.schemeName.toUpperCase(), currentStock - 1);
        }

        finalResults.push({ 
          ...original, 
          id: `${original.id}-rep-${i + 1}`,
          hasScheme: hasSchemeCard
        });
      }
    }
  }

  return finalResults;
}

// ─── Detect One-Of-Each ──────────────────────────────────────────────────────

function isOneOfEachContest(contest: Contest): boolean {
  if (contest.name.toLowerCase().includes('one of each') ||
    contest.name.toLowerCase().includes('one-of-each')) return true;

  const championSlots = contest.lineupConfig.slots.filter(s => s.cardType === 'champion');
  if (championSlots.length !== 4) return false;

  const rarities = championSlots.map(s => s.minRarity.toLowerCase());
  const maxRarities = championSlots.map(s => s.maxRarity.toLowerCase());
  const allExact = rarities.every((r, i) => r === maxRarities[i]);
  const hasAllFour = ['basic', 'rare', 'epic', 'legendary'].every(
    r => rarities.includes(r)
  );
  return allExact && hasAllFour;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generateLineups(params: GenerateParams): GeneratedLineup[] {
  const catalogLookup = buildCatalogLookup(params.catalog);
  const conflictSet = buildConflictSet(params.upcomingMatches);

  // Initialize Strategy Card Stock (Schemes)
  const schemeStockMap = new Map<string, number>();
  for (const card of params.userCards) {
    if (card.cardType === 'SCHEME') {
      const key = String(card.name).toUpperCase().trim();
      schemeStockMap.set(key, (schemeStockMap.get(key) ?? 0) + (card.stackCount ?? 1));
    }
  }

  const championSlots = params.contest.lineupConfig.slots.filter(s => s.cardType === 'champion');
  if (championSlots.length === 0) return [];

  const isOOE = isOneOfEachContest(params.contest);

  if (isOOE) {
    const pool = buildPool(params, catalogLookup);
    return generateOneOfEach(pool, catalogLookup, params, conflictSet, schemeStockMap);
  }

  const pool = buildPool(params, catalogLookup);
  return generateStandard(pool, params, conflictSet, schemeStockMap);
}
