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
  { name: 'Whale Watching', image: '/scheme/whale watching.png', type: 'fur', values: ['1 of 1', '1-of-1'] },
  { name: 'Divine Intervention', image: '/scheme/divine intervention.png', type: 'fur', values: ['Spirit'] },
  { name: 'Midnight Strike', image: '/scheme/midnight strike.png', type: 'fur', values: ['Shadow'] },
  { name: 'Golden Shower', image: '/scheme/golden shower.png', type: 'fur', values: ['Gold'] },
  { name: 'Rainbow Riot', image: '/scheme/rainbow riot.png', type: 'fur', values: ['Rainbow'] },
  { name: 'Shapeshifting', image: '/scheme/shapeshifting.png', type: 'trait', values: ['Tongue Out', 'Tanuki', 'Kitsune', 'Cat Mask'] },
  { name: 'Tear jerking', image: '/scheme/tear jerking.png', type: 'trait', values: ['Crying Eye'] },
  { name: 'Costume party', image: '/scheme/costume party.png', type: 'trait', values: ['Onesie', 'Lemon', 'Kappa', 'Tomato', 'Blob Head'] },
  { name: 'Dress To Impress', image: '/scheme/dress to impress.png', type: 'trait', values: ['Kimono'] },
  { name: 'Call To Arms', image: '/scheme/call to arms.png', type: 'trait', values: ['Ronin', 'Samurai', 'Ronin Aurora', 'Ronin Moon'] },
  { name: 'Malicious Intent', image: '/scheme/malicious intent.png', type: 'trait', values: ['Devious Mouth', 'Oni', 'Tengu', 'Skull Mask'] },
  { name: 'Housekeeping', image: '/scheme/housekeeping.png', type: 'trait', values: ['Apron', 'Garbage Can', 'Gold Can', 'Toilet Paper'] },
  { name: 'Dungaree Duel', image: '/scheme/dungaree duel.png', type: 'trait', values: ['Pink Overalls', 'Blue Overalls', 'Green Overalls'] },
];

const RELEGATED_SCHEMES = [
  { name: 'Touching The Wart', image: '/scheme/touching the wart.png', scoreType: 'wart' as const },
  { name: 'Collective Specialization', image: '/scheme/collective specialization.png', scoreType: 'gacha' as const },
  { name: 'Taking A Dive', image: '/scheme/taking a dive.png', scoreType: 'dive' as const },
];

const COLLECT_EM_ALL = { name: "Collect 'Em All", image: "/scheme/collect em all.png" };

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
    return (moki.gachaPts + (moki.winRate / 10) * 300) + (moki.gachaPts * 0.5);
  }
  return moki.baseScore + getSchemeBonus(moki, scoreType);
}

function calcRankingScore(moki: MokiCandidate, scoreType: ScoreType): number {
  // Ranking Score (Effective): (Base Score * Multiplier) + Bonuses
  const multiplier = getRarityMultiplier(moki.rarity);
  if (scoreType === 'gacha') {
    return (moki.gachaPts + (moki.winRate / 10) * 300) * multiplier + (moki.gachaPts * 0.5);
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

function buildPool(params: GenerateParams, catalogLookup: CatalogLookup, maxRarity: string): MokiCandidate[] {
  const pool: MokiCandidate[] = [];

  for (const row of params.rankingData) {
    if (params.excludeStrikers && (row.Class || '').toLowerCase() === 'striker') continue;

    const name = row.Name;
    if (!name) continue;

    let rarity: string;
    let cardImage: string;
    let copies: number;

    if (params.cardMode === 'ALL') {
      rarity = bestRarityWithinConstraint(maxRarity);
      cardImage = getImageFromCatalog(name, rarity, catalogLookup);
      if (!cardImage) continue; // Not in catalog
      copies = 1;
    } else {
      const owned = getBestOwnedRarityForSlot(name, maxRarity, params.userCards);
      if (!owned) continue;
      rarity = owned.rarity;
      cardImage = owned.image;
      copies = owned.copies;
    }

    pool.push({
      name,
      class: row.Class || '',
      fur: row.Fur || '',
      traits: row.Traits || '',
      baseScore: typeof row.Score === 'number' ? row.Score : parseFloat(String(row.Score || '0')),
      losses: typeof row.Losses === 'number' ? row.Losses : parseFloat(String(row.Losses || '0')),
      wartCloser: typeof row['Wart Closer'] === 'number' ? row['Wart Closer'] : parseFloat(String(row['Wart Closer'] || '0')),
      gachaPts: typeof row['Gacha Pts'] === 'number' ? row['Gacha Pts'] : parseFloat(String(row['Gacha Pts'] || '0')),
      winRate: typeof row.WinRate === 'number' ? row.WinRate : parseFloat(String(row.WinRate || '0').replace('%', '')),
      rarity,
      cardImage,
      copies,
    });
  }

  return pool;
}

// ─── Greedy Lineup Builder ───────────────────────────────────────────────────

function getLineupFingerprint(mokis: MokiCandidate[]): string {
  return [...mokis]
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
    .map(m => `${String(m.name).toUpperCase()}:${m.rarity.toLowerCase()}`)
    .join('|');
}

function buildGreedyLineup(
  candidates: MokiCandidate[],
  usedNames: Set<string>,
  conflictSet: Set<string>,
  avoidConflicts: boolean,
  scoreType: ScoreType,
  minRarity: string,
  maxRarity: string,
): MokiCandidate[] | null {
  const selected: MokiCandidate[] = [];

  for (const candidate of candidates) {
    if (selected.length === 4) break;
    if (usedNames.has(String(candidate.name).toUpperCase())) continue;
    if (!meetsRarityConstraint(String(candidate.rarity), minRarity, maxRarity)) continue;

    if (avoidConflicts && selected.length > 0) {
      const conflicts = selected.some(s => hasConflict(candidate.name, s.name, conflictSet));
      if (conflicts) continue; // Greedy swap: skip and try next
    }

    selected.push(candidate);
  }

  if (selected.length < 4) return null;
  return selected;
}

function buildLineup(
  candidates: MokiCandidate[],
  usedNames: Set<string>,
  conflictSet: Set<string>,
  avoidConflicts: boolean,
  scoreType: ScoreType,
  minRarity: string,
  maxRarity: string,
  scoreMin: number,
  schemeName: string,
  schemeImage: string,
  schemeType: 'trait-fur' | 'relegated' | 'one-of-each',
  id: string,
): GeneratedLineup | null {
  // Sort by effective (Ranking) score but validate by Validation score
  const sorted = [...candidates].sort(
    (a, b) => calcRankingScore(b, scoreType) - calcRankingScore(a, scoreType)
  );

  const mokis = buildGreedyLineup(sorted, usedNames, conflictSet, avoidConflicts, scoreType, minRarity, maxRarity);
  if (!mokis) return null;

  // Apply score cut based on Validation score (Base + Bonuses, no multiplier)
  if (schemeType === 'trait-fur') {
    // Cut on raw sum of base scores (unmultiplied)
    const rawSum = mokis.reduce((s, m) => s + m.baseScore, 0);
    if (rawSum < 14000) return null;
  } else if (schemeType === 'relegated') {
    const valScore = lineupTotalValidation(mokis, scoreType);
    if (valScore < 18000) return null;
  }

  const totalEffectiveScore = lineupTotalEffective(mokis, scoreType);
  const totalBaseScore = lineupBaseOnly(mokis);

  return { id, schemeName, schemeImage, schemeType, mokis, totalBaseScore, totalEffectiveScore };
}

// ─── One-Of-Each Generator ───────────────────────────────────────────────────

function generateOneOfEach(
  pool: MokiCandidate[],
  catalogLookup: CatalogLookup,
  params: GenerateParams,
  conflictSet: Set<string>,
): GeneratedLineup[] {
  const stockMap = new Map<string, number>();
  for (const m of pool) {
    const key = String(m.name).toUpperCase();
    stockMap.set(key, (stockMap.get(key) ?? 0) + m.copies);
  }

  const uniqueLineups: GeneratedLineup[] = [];
  const seenFingerprints = new Set<string>();
  const SAFETY_LIMIT = 100;
  const raritySlots = ['legendary', 'epic', 'rare', 'basic'];

  while (uniqueLineups.length < SAFETY_LIMIT) {
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
        // USER mode: find owned cards for this rarity that have current stock
        for (const row of params.rankingData) {
          const name = String(row.Name).toUpperCase();
          if (usedNamesInLineup.has(name)) continue;
          if ((stockMap.get(name) ?? 0) <= 0) continue;
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
        break; // Couldn't fill this rarity slot
      }
    }

    if (selected.length === 4) {
      const valScore = lineupTotalValidation(selected, 'one-of-each');
      if (valScore >= 18000) {
        const fingerprint = getLineupFingerprint(selected);
        if (!seenFingerprints.has(fingerprint)) {
          const totalEffectiveScore = lineupTotalEffective(selected, 'one-of-each');
          const totalBaseScore = lineupBaseOnly(selected);
          
          uniqueLineups.push({
            id: `ooe-u-${uniqueLineups.length}`,
            schemeName: COLLECT_EM_ALL.name,
            schemeImage: COLLECT_EM_ALL.image,
            schemeType: 'one-of-each',
            mokis: selected,
            totalBaseScore,
            totalEffectiveScore
          });
          seenFingerprints.add(fingerprint);
        }

        // ALWAYS consume stock
        selected.forEach(m => {
          const key = String(m.name).toUpperCase();
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
        finalResults.push({ ...original, id: `${original.id}-rep-${i + 1}` });
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
  minRarity: string,
  maxRarity: string,
): GeneratedLineup[] {
  const stockMap = new Map<string, number>();
  for (const m of pool) {
    const key = String(m.name).toUpperCase();
    stockMap.set(key, (stockMap.get(key) ?? 0) + m.copies);
  }

  const traitPool: GeneratedLineup[] = [];
  const specPool: GeneratedLineup[] = [];
  const globalSeenFingerprints = new Set<string>();
  const SAFETY_LIMIT = 100;

  // Filter schemes if "USE ONLY MY SCHEMES" is active
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

  const getAvailablePool = () => pool.filter(m => (stockMap.get(String(m.name).toUpperCase()) ?? 0) > 0);

  // Phase 1: Trait/Fur Discovery (Priority Group A)
  for (const scheme of traitSchemes) {
    if (traitPool.length + specPool.length >= SAFETY_LIMIT) break;

    let canBuildAnother = true;
    while (canBuildAnother && (traitPool.length + specPool.length < SAFETY_LIMIT)) {
      const currentPool = getAvailablePool().filter(m => mokiMatchesScheme(m as unknown as MokiRankingRow, scheme));
      const lineup = buildLineup(
        currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
        'trait-fur', minRarity, maxRarity, 14000,
        scheme.name, scheme.image, 'trait-fur', `tf-${scheme.name}-${traitPool.length}`
      );

      if (lineup) {
        const fingerprint = getLineupFingerprint(lineup.mokis);
        if (!globalSeenFingerprints.has(fingerprint)) {
          traitPool.push(lineup);
          globalSeenFingerprints.add(fingerprint);
        }
        
        // ALWAYS consume stock for the names picked in this iteration (even if identical strategy)
        // to force discovery of other combinations in the next loop.
        lineup.mokis.forEach(m => {
          const key = String(m.name).toUpperCase();
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      } else {
        canBuildAnother = false;
      }
    }
  }

  // Phase 2: Specialized Discovery (Priority Group B)
  for (const schemeDef of relegatedSchemes) {
    if (traitPool.length + specPool.length >= SAFETY_LIMIT) break;

    if (params.excludeStrikers && (schemeDef.scoreType === 'dive' || schemeDef.scoreType === 'gacha')) continue;

    let canBuildAnother = true;
    while (canBuildAnother && (traitPool.length + specPool.length < SAFETY_LIMIT)) {
      let currentPool = getAvailablePool();
      
      // Strict Stat Filters
      if (schemeDef.scoreType === 'wart') {
        currentPool = currentPool.filter(m => m.wartCloser > 5 && (m.class.toLowerCase() !== 'striker' && m.class.toLowerCase() !== 'sprinter'));
      } else if (schemeDef.scoreType === 'dive') {
        currentPool = currentPool.filter(m => m.losses > 5);
      } else if (schemeDef.scoreType === 'gacha') {
        currentPool = currentPool.filter(m => m.gachaPts > 2000);
      }

      const lineup = buildLineup(
        currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
        schemeDef.scoreType, minRarity, maxRarity, 18000,
        schemeDef.name, schemeDef.image, 'relegated', `rel-${schemeDef.name}-${specPool.length}`
      );

      if (lineup) {
        const fingerprint = getLineupFingerprint(lineup.mokis);
        if (!globalSeenFingerprints.has(fingerprint)) {
          specPool.push(lineup);
          globalSeenFingerprints.add(fingerprint);
        }
        
        // ALWAYS consume stock for the names picked in this iteration (even if identical strategy)
        // to force discovery of other combinations in the next loop.
        lineup.mokis.forEach(m => {
          const key = String(m.name).toUpperCase();
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      } else {
        canBuildAnother = false;
      }
    }
  }

  // Local Ranking inside pools
  traitPool.sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);
  specPool.sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);

  // Combine and sort by GLOBAL SCORE (User requested)
  // No truncation here: we return ALL unique candidates discovered.
  const uniqueMasterList = [...traitPool, ...specPool].sort((a, b) => b.totalEffectiveScore - a.totalEffectiveScore);

  const finalResults: GeneratedLineup[] = [];
  
  // First Pass: Fill with EVERY UNIQUE lineup found (No truncation by lineupCount)
  for (const lineup of uniqueMasterList) {
    // Note: lineupID already unique from discovery.
    finalResults.push({ ...lineup, id: `${lineup.id}-unique` });
  }

  // Second Pass (Repetitions): ONLY if requested and we haven't met the contest entry limit
  if (params.allowRepeated && finalResults.length < params.lineupCount) {
    // Attempt to repeat the absolute best ones to fill the entries up to lineupCount
    for (const original of uniqueMasterList) {
      if (finalResults.length >= params.lineupCount) break;

      // How many copies of this combination can we EXTREMELY make?
      const physicalCopies = params.cardMode === 'USER'
        ? Math.min(...original.mokis.map(m => {
            const entry = params.userCards.find(c => String(c.name).toUpperCase() === String(m.name).toUpperCase() && String(c.rarity).toLowerCase() === String(m.rarity).toLowerCase());
            return entry?.stackCount ?? 1;
          }))
        : 999;
      
      // We already used 1 copy in the first pass
      const remainingToAdd = Math.min(physicalCopies - 1, params.maxRepeated - 1, params.lineupCount - finalResults.length);

      for (let i = 0; i < remainingToAdd; i++) {
        finalResults.push({ ...original, id: `${original.id}-rep-${i + 1}` });
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

  const championSlots = params.contest.lineupConfig.slots.filter(s => s.cardType === 'champion');
  if (championSlots.length === 0) return [];

  const isOOE = isOneOfEachContest(params.contest);

  if (isOOE) {
    const pool = buildPool(params, catalogLookup, 'legendary');
    return generateOneOfEach(pool, catalogLookup, params, conflictSet);
  }

  const firstSlot = championSlots[0];
  const minRarity = firstSlot.minRarity.toLowerCase();
  const maxRarity = firstSlot.maxRarity.toLowerCase();

  const pool = buildPool(params, catalogLookup, maxRarity);
  return generateStandard(pool, params, conflictSet, minRarity, maxRarity);
}
