/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EnhancedCard } from '@/types';
import type { Contest } from '@/types/contest';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScoreType = 'trait-fur' | 'wart' | 'dive' | 'gacha' | 'one-of-each' | 'aggressive' | 'smash';

export interface MokiRankingRow {
  'Moki ID': number;
  Name: string;
  Class: string;
  Score: number;
  WinRate: number | string;
  'Wart Closer': number;
  Losses: number;
  'Gacha Pts': number;
  Kills: number;
  Deaths: number;
  Deposits: number;
  'Wart Distance': number;
  'Matches Played'?: number;
  'Win By Combat'?: number;
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
  kills: number;
  deaths: number;
  deposits: number;
  wartDistance: number;
  winByCombat: number;
  rarity: string;
  cardImage: string;
  copies: number;
  dropped?: boolean;
  modeBaseScore?: number;
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

export interface GameModes {
  noWinBonus: boolean;
  noScheme: boolean;
  bestObjective: boolean;
  medianCap: boolean;
  dropWorst: boolean;
  lowestScore: boolean;
  classCoverage: boolean;
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
  excludedClasses: string[];
  avoidMatchupConflicts: boolean;
  notRepeatChampion?: boolean;
  useOnlyMySchemes?: boolean;
  cardSource: 'ALL' | 'MY';
  selectedScheme?: string;
  selectedTraitScheme?: string;
  modes?: GameModes;
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
  { name: 'Aggressive Specialization', image: '/scheme/aggressive specialization.webp', scoreType: 'aggressive' as const },
  { name: 'Moki Smash', image: '/scheme/moki smash.webp', scoreType: 'smash' as const },
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

let lastUserCardsRef: EnhancedCard[] | null = null;
let cachedUserCardIndex: Map<string, { rarity: string; image: string; copies: number; original: EnhancedCard }[]> = new Map();

function buildUserCardIndex(userCards: EnhancedCard[]) {
  if (userCards === lastUserCardsRef) return cachedUserCardIndex;
  
  cachedUserCardIndex = new Map();
  lastUserCardsRef = userCards;

  for (const card of userCards) {
    if (card.cardType !== 'MOKI') continue;
    const nameKey = String(card.name).toUpperCase();
    if (!cachedUserCardIndex.has(nameKey)) cachedUserCardIndex.set(nameKey, []);
    
    const arr = cachedUserCardIndex.get(nameKey)!;
    const rarityKey = card.rarity.toLowerCase();
    const existing = arr.find(o => o.rarity === rarityKey);
    if (existing) {
      existing.copies += (card.stackCount ?? 1);
    } else {
      arr.push({
        rarity: rarityKey,
        image: card.image,
        copies: card.stackCount ?? 1,
        original: card
      });
    }
  }
  return cachedUserCardIndex;
}

function getOwnedRarities(name: any, userCards: EnhancedCard[]): { rarity: string; image: string; copies: number }[] {
  const index = buildUserCardIndex(userCards);
  return index.get(String(name).toUpperCase()) || [];
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

// ─── Detect One-Of-Each ──────────────────────────────────────────────────────

export function isOneOfEachContest(contest: Contest): boolean {
  if (contest.name.toLowerCase().includes('one of each') ||
    contest.name.toLowerCase().includes('one-of-each') ||
    contest.name.toLowerCase().includes('ooe')) return true;

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

// ─── Score Calculators ───────────────────────────────────────────────────────

// We delete the old getSchemeBonus here since we merged it below.

export function parseGameModes(contest: Contest): GameModes {
  const n = String(contest.name || '').toLowerCase();

  // Detección mejorada de NO SCHEME: Si no hay un slot de 'scheme' en el contest, entonces es No Scheme.
  const hasSchemeSlot = contest.lineupConfig.slots.some((s: any) => s.cardType === 'scheme');
  // One of Each NO usa el slot explícito en su config en la API, pero el algoritmo aplica Collect Em All como un scheme, a menos que el nombre diga 'no scheme'.
  const isNoScheme = (!hasSchemeSlot && !isOneOfEachContest(contest)) || n.includes('no scheme');

  return {
    noWinBonus: n.includes('no win bonus') || n.includes('no win'),
    noScheme: isNoScheme,
    bestObjective: n.includes('best objective'),
    medianCap: n.includes('median cap'),
    dropWorst: n.includes('drop worst') || n.includes('drop worst moki'),
    lowestScore: n.includes('lowest score'),
    classCoverage: n.includes('class coverage') || n.includes('class diversity'),
  };
}

function calculateMokiBaseForMode(moki: MokiCandidate, modes: GameModes | undefined): number {
  if (!modes) return moki.baseScore;

  if (modes.noScheme && !modes.bestObjective && !modes.medianCap && !modes.noWinBonus) {
    return moki.baseScore;
  }

  const scoreDep = moki.deposits * 50;
  const scoreKills = moki.kills * 80;
  const scoreWart = Math.floor(moki.wartDistance / 80) * 40;
  const rawScore = scoreDep + scoreKills + scoreWart;
  const winBonus = modes.noWinBonus ? 0 : (moki.winRate / 100) * 200;

  if (modes.medianCap) {
    const arr = [scoreDep, scoreKills, scoreWart].sort((a, b) => a - b);
    return arr[1]; // Mediana
  }

  if (modes.bestObjective) {
    return Math.max(scoreDep, scoreKills, scoreWart) + winBonus;
  }

  if (modes.noWinBonus || modes.lowestScore) {
    return rawScore;
  }

  return moki.baseScore;
}

function getSchemeBonus(moki: MokiCandidate, scoreType: ScoreType, modes?: GameModes): number {
  if (modes?.noScheme) return 0;

  switch (scoreType) {
    case 'wart': return moki.wartCloser * 175;
    case 'dive': return moki.losses * 175;
    case 'gacha': return (moki.deposits * 25); 
    case 'aggressive': return (moki.kills * 80) * 0.75;
    case 'smash': return moki.winByCombat * 175;
    case 'one-of-each': return 1450 / 4; // 1450 distributed across 4 mokis
    default:
      return modes?.classCoverage ? 1000 + 100 : 1000; // Trait bonus + Class Coverage bonus
  }
}

function calcMokiBaseScore(moki: MokiCandidate, scoreType: ScoreType, modes?: GameModes): number {
  let base = calculateMokiBaseForMode(moki, modes);
  if (scoreType === 'gacha') {
    const wins = moki.winRate / 10;
    const winBonus = modes?.noWinBonus ? 0 : (wins * 200);
    base = (moki.deposits * 50) + winBonus;
  } else if (scoreType === 'aggressive') {
    // Aggressive Specialization: KILLS * 80 + WIN * 200
    const wins = moki.winRate / 10;
    const winBonus = modes?.noWinBonus ? 0 : (wins * 200);
    base = (moki.kills * 80) + winBonus;
  } else if (scoreType === 'smash') {
    // Moki Smash: Base Stats
    base = calculateMokiBaseForMode(moki, modes);
  }
  return base * getRarityMultiplier(moki.rarity);
}

function calcValidationScore(moki: MokiCandidate, scoreType: ScoreType, modes?: GameModes): number {
  const base = calculateMokiBaseForMode(moki, modes);
  if (scoreType === 'gacha') {
    const wins = moki.winRate / 10;
    const winBonus = modes?.noWinBonus ? 0 : (wins * 200);
    const baseGacha = (moki.deposits * 50) + winBonus;
    return baseGacha + getSchemeBonus(moki, scoreType, modes);
  } else if (scoreType === 'aggressive') {
    const wins = moki.winRate / 10;
    const winBonus = modes?.noWinBonus ? 0 : (wins * 200);
    const baseAggressive = (moki.kills * 80) + winBonus;
    return baseAggressive + getSchemeBonus(moki, scoreType, modes);
  } else if (scoreType === 'smash') {
    const baseSmash = calculateMokiBaseForMode(moki, modes);
    return baseSmash + getSchemeBonus(moki, scoreType, modes);
  }
  return base + getSchemeBonus(moki, scoreType, modes);
}

function calcRankingScore(moki: MokiCandidate, scoreType: ScoreType, modes?: GameModes): number {
  return calcMokiBaseScore(moki, scoreType, modes) + getSchemeBonus(moki, scoreType, modes);
}

function calcEffective(moki: MokiCandidate, scoreType: ScoreType, modes?: GameModes): number {
  return calcRankingScore(moki, scoreType, modes);
}

function lineupTotalEffective(mokis: MokiCandidate[], scoreType: ScoreType, modes?: GameModes): number {
  mokis.forEach(m => {
    m.modeBaseScore = calcMokiBaseScore(m, scoreType, modes);
  });

  if (modes?.dropWorst && mokis.length === 4) {
    const scores = mokis.map(m => calcRankingScore(m, scoreType, modes));
    const minVal = Math.min(...scores);
    const total = scores.reduce((a, b) => a + b, 0);
    // Mark dropped
    const worstIdx = scores.indexOf(minVal);
    if (worstIdx !== -1) mokis[worstIdx].dropped = true;
    return total - minVal;
  }
  return mokis.reduce((sum, m) => sum + calcRankingScore(m, scoreType, modes), 0);
}

function lineupTotalValidation(mokis: MokiCandidate[], scoreType: ScoreType, modes?: GameModes): number {
  return mokis.reduce((sum, m) => sum + calcValidationScore(m, scoreType, modes), 0);
}

function lineupBaseOnly(mokis: MokiCandidate[], modes?: GameModes): number {
  return mokis.reduce((sum, m) => sum + (m.dropped ? 0 : (m.modeBaseScore ?? (calculateMokiBaseForMode(m, modes) * getRarityMultiplier(m.rarity)))), 0);
}

// ─── Pool Builder ────────────────────────────────────────────────────────────

function buildPool(params: GenerateParams, catalogLookup: CatalogLookup): MokiCandidate[] {
  const pool: MokiCandidate[] = [];

  for (const row of params.rankingData) {
    const mokiClass = (row.Class || '').toUpperCase();
    if (params.excludedClasses.some(exc => mokiClass.startsWith(exc))) continue;

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
      kills: typeof row.Kills === 'number' ? row.Kills : parseFloat(String(row.Kills || '0')),
      deaths: typeof row.Deaths === 'number' ? row.Deaths : parseFloat(String(row.Deaths || '0')),
      deposits: typeof row.Deposits === 'number' ? row.Deposits : parseFloat(String(row.Deposits || '0')),
      wartDistance: typeof row['Wart Distance'] === 'number' ? row['Wart Distance'] : parseFloat(String(row['Wart Distance'] || '0')),
      winByCombat: typeof row['Win By Combat'] === 'number' ? row['Win By Combat'] : parseFloat(String(row['Win By Combat'] || '0')),
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
  modes?: GameModes,
): MokiCandidate[] | null {
  const selected: MokiCandidate[] = [];
  const localUsedNames = new Set<string>();
  const localUsedClasses = new Set<string>();

  // Sort slots: For lowest score, process lowest valid rarities first. For normal, process max valid rarities first.
  const sortedSlots = modes?.lowestScore
    ? [...slots].sort((a, b) => getRarityRank(a.minRarity) - getRarityRank(b.minRarity))
    : [...slots].sort((a, b) => getRarityRank(b.maxRarity) - getRarityRank(a.maxRarity));

  for (const slot of sortedSlots) {
    const minR = slot.minRarity.toLowerCase();
    const maxR = slot.maxRarity.toLowerCase();

    let foundForSlot = false;

    // Use a secondary loop to pick the best candidate that fits the current slot
    for (const candidate of candidates) {
      const nameKey = String(candidate.name).toUpperCase();
      const stockKey = `${nameKey}:${candidate.rarity.toUpperCase()}`;

      if (usedNames.has(nameKey) || localUsedNames.has(nameKey)) continue;

      // Class Coverage restriction: force unique classes
      if (modes?.classCoverage) {
        const cClass = String(candidate.class).toUpperCase();
        if (localUsedClasses.has(cClass)) continue;

        // "Y siempre los slots de la mayor rareza, si los hay, ocupadas por defender/striker"
        if (selected.length === 0) {
          if (cClass !== 'DEFENDER' && cClass !== 'STRIKER') continue;
        } else if (selected.length === 1) {
          const firstClass = String(selected[0].class).toUpperCase();
          if (firstClass === 'DEFENDER' && cClass !== 'STRIKER') continue;
          if (firstClass === 'STRIKER' && cClass !== 'DEFENDER') continue;
        }
      }

      // Stock check: LITERAL check for this specific rarity in the inventory
      if ((stockMap.get(stockKey) ?? 0) <= 0) continue;

      // Rarity enforcement:
      // For Normal modes, strictly enforce the highest possible rarity allowed (maxR).
      // For Lowest Score, strictly enforce the lowest possible rarity allowed (minR).
      const targetedRarity = modes?.lowestScore ? minR.toLowerCase() : maxR.toLowerCase();
      if (candidate.rarity.toLowerCase() !== targetedRarity) continue;

      if (avoidConflicts && selected.length > 0) {
        if (selected.some(s => hasConflict(candidate.name, s.name, conflictSet))) continue;
      }

      selected.push({ ...candidate }); // Clone to prevent mutation leaks (dropped, modeBaseScore)
      localUsedNames.add(nameKey);
      localUsedClasses.add(String(candidate.class).toUpperCase());
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
  modes?: GameModes,
): GeneratedLineup | null {

  // Sort descending normally (1), or ascending if Lowest Score (-1)
  const sortDirection = modes?.lowestScore ? -1 : 1;
  const sorted = [...candidates].sort(
    (a, b) => sortDirection * (calcRankingScore(b, scoreType, modes) - calcRankingScore(a, scoreType, modes))
  );

  const mokis = buildGreedyLineup(sorted, usedNames, conflictSet, avoidConflicts, scoreType, slots, stockMap, modes);
  if (!mokis) return null;

  // Thresholds removed for testing and debugging.

  const totalEffectiveScore = lineupTotalEffective(mokis, scoreType, modes);
  const totalBaseScore = lineupBaseOnly(mokis, modes);

  return { id, schemeName, schemeImage, schemeType, mokis, totalBaseScore, totalEffectiveScore, hasScheme: !modes?.noScheme };
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
  const globalUsedNames = new Set<string>();
  const SAFETY_LIMIT = 20;
  const raritySlots = ['legendary', 'epic', 'rare', 'basic'];

  while (uniqueLineups.length < SAFETY_LIMIT) {
    // If using only my schemes, check if we have "Collect Em All" cards left
    if (params.useOnlyMySchemes && !params.modes?.noScheme) {
      const stock = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
      if (stock <= 0) break;
    }

    const selected: MokiCandidate[] = [];
    const usedNamesInLineup = new Set<string>();
    const usedClassesInLineup = new Set<string>();

    for (const targetRarity of raritySlots) {
      let slotCandidates: MokiCandidate[] = [];

      if (params.cardMode === 'ALL') {
        slotCandidates = pool
          .filter(m => !usedNamesInLineup.has(String(m.name).toUpperCase()) && (!params.notRepeatChampion || !globalUsedNames.has(String(m.name).toUpperCase())))
          .filter(m => (stockMap.get(`${String(m.name).toUpperCase()}:${targetRarity.toUpperCase()}`) ?? 0) > 0)
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
          if (params.notRepeatChampion && globalUsedNames.has(name)) continue;

          const stockKey = `${name}:${targetRarity.toUpperCase()}`;
          if ((stockMap.get(stockKey) ?? 0) <= 0) continue;

          const mokiClass = String(row.Class).toUpperCase();
          if (params.excludedClasses.some(exc => mokiClass.startsWith(exc))) continue;

          const arr = buildUserCardIndex(params.userCards).get(name);
          const ownedEntry = arr?.find(c => c.rarity === targetRarity);
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
            kills: parseFloat(String(row.Kills || '0')),
            deaths: parseFloat(String(row.Deaths || '0')),
            deposits: parseFloat(String(row.Deposits || '0')),
            wartDistance: parseFloat(String(row['Wart Distance'] || '0')),
            winByCombat: parseFloat(String(row['Win By Combat'] || '0')),
          });
        }
      }

      slotCandidates.sort((a, b) => {
        // Sort descending normally (1), or ascending if Lowest Score (-1)
        const sortDirection = params.modes?.lowestScore ? -1 : 1;
        return sortDirection * (calcRankingScore(b, 'one-of-each', params.modes) - calcRankingScore(a, 'one-of-each', params.modes));
      });

      let chosen: MokiCandidate | null = null;
      for (const candidate of slotCandidates) {
        if (params.avoidMatchupConflicts && selected.length > 0) {
          if (selected.some(s => hasConflict(candidate.name, s.name, conflictSet))) continue;
        }

        const cClass = String(candidate.class).toUpperCase();
        
        // For One Of Each + Best Objective: always strikers
        if (params.modes?.bestObjective && cClass !== 'STRIKER') {
          continue;
        }

        if (params.modes?.classCoverage) {
          if (usedClassesInLineup.has(cClass)) continue;

          // "Y siempre los slots de la mayor rareza, si los hay, ocupadas por defender/striker"
          if (selected.length === 0) { // Legendary (in OOE, raritySlots goes legendary -> basic)
            if (cClass !== 'DEFENDER' && cClass !== 'STRIKER') continue;
          } else if (selected.length === 1) { // Epic
            const firstClass = String(selected[0].class).toUpperCase();
            if (firstClass === 'DEFENDER' && cClass !== 'STRIKER') continue;
            if (firstClass === 'STRIKER' && cClass !== 'DEFENDER') continue;
          }
        }

        chosen = candidate;
        break;
      }

      if (chosen) {
        selected.push(chosen);
        usedNamesInLineup.add(String(chosen.name).toUpperCase());
        usedClassesInLineup.add(String(chosen.class).toUpperCase());

        // FIX DEFAULT INFINITE LOOP: In 'ALL' mode, we MUST consume stockMap internally during sim
        if (params.cardMode === 'ALL') {
          const key = `${String(chosen.name).toUpperCase()}:${chosen.rarity.toUpperCase()}`;
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 1) - 1));
        }

      } else {
        break;
      }
    }

    if (selected.length === 4) {
      // Thresholds removed for testing
      const fingerprint = getLineupFingerprint(selected);
      if (!seenFingerprints.has(fingerprint)) {
        const totalEffectiveScore = lineupTotalEffective(selected, 'one-of-each', params.modes);
        const totalBaseScore = lineupBaseOnly(selected, params.modes);

        // If noScheme or lowestScore, don't use COLLECT_EM_ALL
        const useScheme = !params.modes?.noScheme && !params.modes?.lowestScore;
        const current = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
        const hasSchemeCard = useScheme && (params.cardMode === 'ALL' || current > 0);
        if (hasSchemeCard && params.cardMode === 'USER') {
          schemeStockMap.set(COLLECT_EM_ALL.name.toUpperCase(), current - 1);
        }

        uniqueLineups.push({
          id: `ooe-u-${uniqueLineups.length}`,
          schemeName: useScheme ? COLLECT_EM_ALL.name : '',
          schemeImage: useScheme ? COLLECT_EM_ALL.image : '',
          schemeType: 'one-of-each',
          mokis: selected,
          totalBaseScore,
          totalEffectiveScore,
          hasScheme: hasSchemeCard
        });
        seenFingerprints.add(fingerprint);

        if (params.notRepeatChampion) {
          selected.forEach(m => globalUsedNames.add(String(m.name).toUpperCase()));
        }
      }

      if (params.cardMode === 'USER') {
        selected.forEach(m => {
          const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
          stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
        });
      }
    } else {
      break;
    }
  }

  const sortDirection = params.modes?.lowestScore ? -1 : 1;
  uniqueLineups.sort((a, b) => sortDirection * (b.totalEffectiveScore - a.totalEffectiveScore));

  const finalResults: GeneratedLineup[] = [];

  for (const original of uniqueLineups) {
    finalResults.push({ ...original, id: `${original.id}-unique` });

    if (params.allowRepeated && !params.notRepeatChampion) {
      const physicalCopies = params.cardMode === 'USER'
        ? Math.min(...original.mokis.map(m => {
          const arr = buildUserCardIndex(params.userCards).get(String(m.name).toUpperCase());
          const entry = arr?.find(c => c.rarity === String(m.rarity).toLowerCase());
          return entry?.copies ?? 1;
        }))
        : 999;

      const remainingToAdd = Math.min(physicalCopies - 1, params.maxRepeated - 1);

      for (let i = 0; i < remainingToAdd; i++) {
        // Repeated lineups also consume scheme stock if available
        let hasSchemeCard = false;
        if (!params.modes?.noScheme) {
          const currentStock = schemeStockMap.get(COLLECT_EM_ALL.name.toUpperCase()) ?? 0;
          hasSchemeCard = currentStock > 0;
          if (hasSchemeCard) {
            schemeStockMap.set(COLLECT_EM_ALL.name.toUpperCase(), currentStock - 1);
          }
        }

        finalResults.push({
          ...original,
          id: `${original.id}-rep-${i + 1}`,
          mokis: original.mokis.map(m => ({ ...m, dropped: false })), // DEEP CLONE and reset dropped
          hasScheme: hasSchemeCard
        });
      }
    }
  }

  // Final sort to ensure absolute lowest score is first if Lowest Score mode is on
  finalResults.sort((a, b) => {
    return params.modes?.lowestScore 
      ? (a.totalEffectiveScore - b.totalEffectiveScore) 
      : (b.totalEffectiveScore - a.totalEffectiveScore);
  });

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
  const globalUsedNames = new Set<string>();
  const SAFETY_LIMIT = 20;

  let traitLimit = SAFETY_LIMIT;
  let specLimit = SAFETY_LIMIT;

  if (params.modes?.classCoverage) {
    traitLimit = 10;
    specLimit = 10;
  }

  let traitSchemes = TRAIT_FUR_SCHEMES;
  let relegatedSchemes: any[] = RELEGATED_SCHEMES;

  if (params.useOnlyMySchemes) {
    const ownedSchemeNames = new Set(
      params.userCards
        .filter(c => c.cardType === 'SCHEME')
        .map(c => String(c.name).toUpperCase().trim())
    );
    traitSchemes = TRAIT_FUR_SCHEMES.filter(s => ownedSchemeNames.has(s.name.toUpperCase().trim()));
    relegatedSchemes = RELEGATED_SCHEMES.filter(s => ownedSchemeNames.has(s.name.toUpperCase().trim()));
  }

  // Modifiers Unchained
  if (params.modes?.lowestScore) {
    traitSchemes = [];
    relegatedSchemes = [
      { name: 'Enforcing The Naughty List', image: '/scheme/enforcing the naughty list.webp', scoreType: 'lowest-naughty' as any },
      { name: 'Gacha Hoarding', image: '/scheme/gacha hoarding.webp', scoreType: 'lowest-gacha' as any }
    ];
  }
  
  if (params.modes?.classCoverage) {
    relegatedSchemes = [{ name: 'Taking A Dive', image: '/scheme/taking a dive.webp', scoreType: 'dive' as any }];
  }

  if (params.modes?.noScheme) {
    traitSchemes = [];
    relegatedSchemes = [{ name: 'No Scheme', image: '', scoreType: 'trait-fur' as any }];
  }

  // User forced scheme selection
  const filterScheme = params.selectedScheme?.toUpperCase();
  if (filterScheme && filterScheme !== 'ALL') {
    if (filterScheme === 'TRAIT') {
      relegatedSchemes = [];
      const filterTraitScheme = params.selectedTraitScheme?.toUpperCase();
      if (filterTraitScheme && filterTraitScheme !== 'ALL') {
        traitSchemes = traitSchemes.filter(s => s.name.toUpperCase() === filterTraitScheme);
      }
    } else {
      traitSchemes = [];
      relegatedSchemes = relegatedSchemes.filter(s => s.name.toUpperCase() === filterScheme);
    }
  }

  const getAvailablePool = () => pool.filter(m => {
    if (params.notRepeatChampion && globalUsedNames.has(String(m.name).toUpperCase())) return false;
    return (stockMap.get(`${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`) ?? 0) > 0;
  });

  let canBuildAnother = true;
  while (canBuildAnother && (traitPool.length + specPool.length) < SAFETY_LIMIT) {
    let bestLineup: GeneratedLineup | null = null;
    let bestScheme: any | null = null;
    let isTrait = false;

    // Evaluate all valid trait schemes
    if (traitPool.length < traitLimit) {
      for (const scheme of traitSchemes) {
        if (params.useOnlyMySchemes && !params.modes?.noScheme) {
          if ((schemeStockMap.get(scheme.name.toUpperCase()) ?? 0) <= 0) continue;
        }

        const currentPool = getAvailablePool().filter(m => mokiMatchesScheme(m as unknown as MokiRankingRow, scheme));
        const lineup = buildLineup(
          currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
          'trait-fur', championSlots, 14000,
          scheme.name, scheme.image, 'trait-fur', `tf-${scheme.name}-${traitPool.length + specPool.length}`,
          stockMap, params.modes
        );

        if (lineup) {
          if (!bestLineup) {
            bestLineup = lineup;
            bestScheme = scheme;
            isTrait = true;
          } else {
            const isBetter = params.modes?.lowestScore 
              ? lineup.totalEffectiveScore < bestLineup.totalEffectiveScore 
              : lineup.totalEffectiveScore > bestLineup.totalEffectiveScore;
            if (isBetter) {
              bestLineup = lineup;
              bestScheme = scheme;
              isTrait = true;
            }
          }
        }
      }
    }

    // Evaluate all valid relegated schemes
    if (specPool.length < specLimit) {
      for (const schemeDef of relegatedSchemes) {
        if (params.excludedClasses.includes('STRIKER') && (schemeDef.scoreType === 'dive' || schemeDef.scoreType === 'gacha')) continue;

        if (params.useOnlyMySchemes && !params.modes?.noScheme) {
          if ((schemeStockMap.get(schemeDef.name.toUpperCase()) ?? 0) <= 0) continue;
        }

        let currentPool = getAvailablePool();

        if (schemeDef.scoreType === 'wart') {
          currentPool = currentPool.filter(m => m.wartCloser > 5 && (m.class.toLowerCase() !== 'striker'));
        } else if (schemeDef.scoreType === 'dive') {
          currentPool = currentPool.filter(m => m.losses > 5);
        } else if (schemeDef.scoreType === 'gacha') {
          currentPool = currentPool.filter(m => m.deposits >= 38);
        } else if (schemeDef.scoreType === ('lowest-naughty' as any)) {
          currentPool = currentPool.filter(m => m.class.toUpperCase() === 'STRIKER');
        } else if (schemeDef.scoreType === ('lowest-gacha' as any)) {
          currentPool = currentPool.filter(m => m.class.toUpperCase() === 'DEFENDER');
        } else if (schemeDef.scoreType === 'aggressive') {
          currentPool = currentPool.filter(m => m.class.toUpperCase() === 'BRUISER');
        } else if (schemeDef.scoreType === 'smash') {
          currentPool = currentPool.filter(m => m.class.toUpperCase() !== 'STRIKER');
        }

        const lineup = buildLineup(
          currentPool, new Set(), conflictSet, params.avoidMatchupConflicts,
          schemeDef.scoreType, championSlots, 18000,
          schemeDef.name, schemeDef.image, 'relegated', `rel-${schemeDef.name}-${traitPool.length + specPool.length}`,
          stockMap, params.modes
        );

        if (lineup) {
          if (!bestLineup) {
            bestLineup = lineup;
            bestScheme = schemeDef;
            isTrait = false;
          } else {
            const isBetter = params.modes?.lowestScore 
              ? lineup.totalEffectiveScore < bestLineup.totalEffectiveScore 
              : lineup.totalEffectiveScore > bestLineup.totalEffectiveScore;
            if (isBetter) {
              bestLineup = lineup;
              bestScheme = schemeDef;
              isTrait = false;
            }
          }
        }
      }
    }

    if (bestLineup && bestScheme) {
      const fingerprint = getLineupFingerprint(bestLineup.mokis);
      if (!globalSeenFingerprints.has(fingerprint)) {
        const currentStock = schemeStockMap.get(bestScheme.name.toUpperCase()) ?? 0;
        const hasSchemeCard = params.cardMode === 'ALL' || currentStock > 0;
        if (hasSchemeCard && params.cardMode === 'USER') {
          schemeStockMap.set(bestScheme.name.toUpperCase(), currentStock - 1);
        }

        const lineupWithOwnership = { ...bestLineup, hasScheme: hasSchemeCard };
        if (isTrait) {
          traitPool.push(lineupWithOwnership);
        } else {
          specPool.push(lineupWithOwnership);
        }
        globalSeenFingerprints.add(fingerprint);
        
        if (params.notRepeatChampion) {
          bestLineup.mokis.forEach(m => globalUsedNames.add(String(m.name).toUpperCase()));
        }
      }

      bestLineup.mokis.forEach(m => {
        // ALWAYS consume stock specifically for the Moki:Rarity used
        const key = `${String(m.name).toUpperCase()}:${m.rarity.toUpperCase()}`;
        stockMap.set(key, Math.max(0, (stockMap.get(key) ?? 0) - 1));
      });
    } else {
      canBuildAnother = false;
    }
  }

  const sortDirection = params.modes?.lowestScore ? -1 : 1;
  traitPool.sort((a, b) => sortDirection * (b.totalEffectiveScore - a.totalEffectiveScore));
  specPool.sort((a, b) => sortDirection * (b.totalEffectiveScore - a.totalEffectiveScore));

  const uniqueMasterList = [...traitPool, ...specPool].sort((a, b) => sortDirection * (b.totalEffectiveScore - a.totalEffectiveScore));

  const finalResults: GeneratedLineup[] = [];

  for (const original of uniqueMasterList) {
    finalResults.push({ ...original, id: `${original.id}-unique` });

    if (params.allowRepeated && !params.notRepeatChampion) {
      const physicalCopies = params.cardMode === 'USER'
        ? Math.min(...original.mokis.map(m => {
          const arr = buildUserCardIndex(params.userCards).get(String(m.name).toUpperCase());
          const entry = arr?.find(c => c.rarity === String(m.rarity).toLowerCase());
          return entry?.copies ?? 1;
        }))
        : 999;

      const remainingToAdd = Math.min(physicalCopies - 1, params.maxRepeated - 1);

      for (let i = 0; i < remainingToAdd; i++) {
        const currentStock = schemeStockMap.get(original.schemeName.toUpperCase()) ?? 0;
        const hasSchemeCard = currentStock > 0;
        if (hasSchemeCard) {
          schemeStockMap.set(original.schemeName.toUpperCase(), currentStock - 1);
        }

        finalResults.push({
          ...original,
          id: `${original.id}-rep-${i + 1}`,
          mokis: original.mokis.map(m => ({ ...m, dropped: false })), // DEEP CLONE and reset dropped
          hasScheme: hasSchemeCard
        });
      }
    }
  }

  // Final sort to ensure absolute lowest score is first if Lowest Score mode is on
  finalResults.sort((a, b) => {
    return params.modes?.lowestScore 
      ? (a.totalEffectiveScore - b.totalEffectiveScore) 
      : (b.totalEffectiveScore - a.totalEffectiveScore);
  });

  return finalResults;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function generateLineups(params: GenerateParams): GeneratedLineup[] {
  params.modes = parseGameModes(params.contest);

  if (params.modes.medianCap) {
    if (!params.excludedClasses.includes('STRIKER')) params.excludedClasses.push('STRIKER');
    if (!params.excludedClasses.includes('BRUISER')) params.excludedClasses.push('BRUISER');
  }

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

  let results: GeneratedLineup[] = [];

  if (isOOE) {
    const pool = buildPool(params, catalogLookup);
    results = generateOneOfEach(pool, catalogLookup, params, conflictSet, schemeStockMap);
  } else {
    const pool = buildPool(params, catalogLookup);
    results = generateStandard(pool, params, conflictSet, schemeStockMap);
  }

  // --- Apply dynamic 10% threshold filter ---
  if (results.length > 0) {
    const bestScore = results[0].totalEffectiveScore; // Array is sorted by generator
    if (params.modes.lowestScore) {
      // In lowest score mode, lower is better. We tolerate up to 10% HIGHER than the minimum.
      const threshold = bestScore * 1.1; 
      results = results.filter(l => l.totalEffectiveScore <= threshold);
    } else {
      // Normal mode: tolerate up to 10% LOWER than the max.
      const threshold = bestScore * 0.9;
      results = results.filter(l => l.totalEffectiveScore >= threshold);
    }
  }

  // --- Enforce lineupCount limit ---
  // The 10% threshold rule is the primary threshold, overriding the lineupCount limit.
  // if (results.length > params.lineupCount) {
  //   results = results.slice(0, params.lineupCount);
  // }

  // --- Allocate correct distinct images if cardMode === 'USER' ---
  if (params.cardMode === 'USER') {
    const imageQueue = new Map<string, string[]>();
    for (const card of params.userCards) {
      if (card.cardType === 'MOKI') {
        const key = `${String(card.name).toUpperCase()}:${String(card.rarity).toUpperCase()}`;
        const q = imageQueue.get(key) ?? [];
        for (let i = 0; i < (card.stackCount ?? 1); i++) {
          q.push(card.image);
        }
        imageQueue.set(key, q);
      }
    }

    for (const lineup of results) {
      for (const moki of lineup.mokis) {
        const key = `${String(moki.name).toUpperCase()}:${String(moki.rarity).toUpperCase()}`;
        const q = imageQueue.get(key);
        if (q && q.length > 0) {
          moki.cardImage = q.shift()!;
        }
      }
    }
  }

  return results;
}