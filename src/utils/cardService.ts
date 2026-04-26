/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchLiveData, fetchCatalogData, LiveDataMap } from './liveData';
import { EnhancedCard } from '@/types';
import { getFromDB, setInDB } from './idb';

// Cache live data in memory
let cachedLiveData: LiveDataMap | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000;

export const localSchemeImages: { [key: string]: string } = {
  'AGGRESSIVE SPECIALIZATION': '/scheme/aggressive specialization.webp',
  'BAITING THE TRAP': '/scheme/baiting the trap.webp',
  'BEAT THE BUZZER': '/scheme/beat the buzzer.webp',
  'BIG GAME HUNT': '/scheme/big game hunt.webp',
  'CAGE MATCH': '/scheme/cage match.webp',
  'CALL TO ARMS': '/scheme/call to arms.webp',
  'COLLECT EM ALL': '/scheme/collect em all.webp',
  "COLLECT 'EM ALL": '/scheme/collect em all.webp',
  'COLLECTIVE SPECIALIZATION': '/scheme/collective specialization.webp',
  'COSTUME PARTY': '/scheme/costume party.webp',
  'CURSED DINNER': '/scheme/cursed dinner.webp',
  'DIVINE INTERVENTION': '/scheme/divine intervention.webp',
  'DRESS TO IMPRESS': '/scheme/dress to impress.webp',
  'DUNGAREE DUEL': '/scheme/dungaree duel.webp',
  'ENFORCING THE NAUGHTY LIST': '/scheme/enforcing the naughty list.webp',
  'FINAL BLOW': '/scheme/final blow.webp',
  FLEXING: '/scheme/flexing.webp',
  'GACHA GOUGING': '/scheme/gacha gouging.webp',
  'GACHA HOARDING': '/scheme/gacha hoarding.webp',
  'GOLDEN SHOWER': '/scheme/golden shower.webp',
  'GRABBING BALLS': '/scheme/grabbing balls.webp',
  HOUSEKEEPING: '/scheme/housekeeping.webp',
  'LITTER COLLECTION': '/scheme/litter collection.webp',
  'MALICIOUS INTENT': '/scheme/malicious intent.webp',
  'MIDNIGHT STRIKE': '/scheme/midnight strike.webp',
  'MOKI SMASH': '/scheme/moki smash.webp',
  'RAINBOW RIOT': '/scheme/rainbow riot.webp',
  'RUNNING INTERFERENCE': '/scheme/running interference.webp',
  SACCING: '/scheme/saccing.webp',
  SHAPESHIFTING: '/scheme/shapeshifting.webp',
  'TAKING A DIVE': '/scheme/taking a dive.webp',
  'TEAR JERKING': '/scheme/tear jerking.webp',
  'TOUCHING THE WART': '/scheme/touching the wart.webp',
  'VICTORY LAP': '/scheme/victory lap.webp',
  'WART RODEO': '/scheme/wart rodeo.webp',
  'WHALE WATCHING': '/scheme/whale watching.webp',
};

/**
 * Shared helper to build an EnhancedCard consistently across "All Cards" and "My Cards"
 */
const buildEnhancedCard = (
  id: string,
  name: string,
  rarity: string,
  cardType: 'MOKI' | 'SCHEME' | 'OTHER',
  baseImage: string,
  description: string,
  isSpecial: boolean,
  seriesInfo?: { category: string; series: string; item: string },
  championTokenId?: number,
  catalogMarket?: string,
  apiCardOriginal?: APICard
): EnhancedCard => {
  const normalizedName = name.trim().toUpperCase();
  const isScheme = cardType === 'SCHEME';

  // Look up stats from existing live data
  const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

  // Card art = the actual NFT card image (from catalog or API).
  // Portrait = the in-game character image (from mokiMetadata via liveData merge).
  const cardImage = baseImage || '';
  const portraitUrl = stats?.imageUrl || ''; // mokiMetadata.portraitUrl, resolved by liveData merge

  // characterImage: for Schemes use scheme asset; for Mokis prefer the portrait over the card art.
  const characterImage = isScheme
    ? localSchemeImages[normalizedName] || cardImage
    : portraitUrl || cardImage;

  // Determine market link
  let catalogMarketLink = '#';
  if (isSpecial) {
    const categoryObj = seriesInfo?.category?.toUpperCase() || '';
    if (categoryObj === 'FULL ART') {
      const seriesQuery = seriesInfo?.series
        ? encodeURIComponent(seriesInfo.series)
        : '';
      catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Series=${seriesQuery}`;
    } else if (categoryObj === 'OVERLAY' || categoryObj === 'BORDER') {
      const seriesQuery = seriesInfo?.series
        ? encodeURIComponent(seriesInfo.series)
        : '';
      if (championTokenId !== undefined) {
        catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Champion%20Token%20ID_max=${championTokenId}&Champion%20Token%20ID_min=${championTokenId}&Series=${seriesQuery}`;
      }
    } else {
      catalogMarketLink = '#';
    }
  } else {
    catalogMarketLink = catalogMarket || '#';
  }

  return {
    id: id,
    name: name,
    description: description,
    image: cardImage,
    external_url: stats?.marketLink || '',
    rarity,
    cardType,
    tokenId: apiCardOriginal?.tokenId,
    serializedId: apiCardOriginal?.serialized?.id,
    serializedMax: apiCardOriginal?.serialized?.max,
    seriesCategory: seriesInfo?.category,
    seriesInfo: seriesInfo,
    isSpecial,
    attributes: [
      { trait_type: 'Rarity', value: rarity },
      { trait_type: 'Card Type', value: cardType },
    ],
    custom: {
      stars: stats?.stars || 0,
      class: isScheme ? 'Scheme' : stats?.class,
      fur: stats?.fur,
      traits: stats?.traits || [],
      eliminations: stats?.eliminations,
      deposits: stats?.deposits,
      wartDistance: stats?.wartDistance,
      score: stats?.score,
      winRate: stats?.winRate,
      avgEliminations: stats?.avgEliminations,
      avgDeposits: stats?.avgDeposits,
      avgWartDistance: stats?.avgWartDistance,
      avgScore: stats?.avgScore,
      avgWinRate: stats?.avgWinRate,
      avgEliminations10: stats?.avgEliminations10,
      avgDeposits10: stats?.avgDeposits10,
      avgWartDistance10: stats?.avgWartDistance10,
      avgScore10: stats?.avgScore10,
      avgWinRate10: stats?.avgWinRate10,
      avgEliminations20: stats?.avgEliminations20,
      avgDeposits20: stats?.avgDeposits20,
      avgWartDistance20: stats?.avgWartDistance20,
      avgScore20: stats?.avgScore20,
      avgWinRate20: stats?.avgWinRate20,
      avgEndedGame10: stats?.avgEndedGame10,
      avgDeaths10: stats?.avgDeaths10,
      avgEatingWhileRiding10: stats?.avgEatingWhileRiding10,
      avgBuffTime10: stats?.avgBuffTime10,
      avgWartTime10: stats?.avgWartTime10,
      avgLooseBallPickups10: stats?.avgLooseBallPickups10,
      avgEatenByWart10: stats?.avgEatenByWart10,
      avgWartCloser10: stats?.avgWartCloser10,
      avgEndedGame20: stats?.avgEndedGame20,
      avgDeaths20: stats?.avgDeaths20,
      avgEatingWhileRiding20: stats?.avgEatingWhileRiding20,
      avgBuffTime20: stats?.avgBuffTime20,
      avgWartTime20: stats?.avgWartTime20,
      avgLooseBallPickups20: stats?.avgLooseBallPickups20,
      avgEatenByWart20: stats?.avgEatenByWart20,
      avgWartCloser20: stats?.avgWartCloser20,
      imageUrl: portraitUrl || cardImage,
      characterImage,
      defense: stats?.defense,
      dexterity: stats?.dexterity,
      fortitude: stats?.fortitude,
      speed: stats?.speed,
      strength: stats?.strength,
      totalStats: stats?.totalStats,
      train: stats?.train,
      marketLink: stats?.marketLink,
      series: seriesInfo?.series,
      catalogMarketLink: catalogMarketLink,
      traitSchemes: stats?.traitSchemes || [],
    },
    category: seriesInfo?.category,
  };
};

const normalizeLiteCard = (catalogItem: {
  id: string;
  name: string;
  rarity: string;
  image: string;
  description?: string;
  market?: string;
}): EnhancedCard => {
  const normalizedName = catalogItem.name.trim().toUpperCase();
  const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

  const isScheme =
    catalogItem.id.toLowerCase().startsWith('scheme') ||
    (normalizedName.includes(' ') && !stats);
  const cardType = isScheme ? 'SCHEME' : 'MOKI';
  const id = isScheme ? `Scheme-${catalogItem.name}` : catalogItem.id;
  const desc =
    catalogItem.description || `Grand Arena Lite - ${catalogItem.name}`;

  return buildEnhancedCard(
    id,
    catalogItem.name,
    catalogItem.rarity || 'Basic',
    cardType,
    catalogItem.image || '',
    desc,
    false, // catalog items aren't "special" series by default
    undefined,
    undefined,
    catalogItem.market
  );
};

export const fetchLiteCollection = async (): Promise<EnhancedCard[]> => {
  console.log('[CardService] Starting lite collection fetch...');
  const now = Date.now();
  if (!cachedLiveData || now - lastFetchTime > CACHE_DURATION) {
    try {
      const live = await fetchLiveData();
      if (live) {
        cachedLiveData = live;
        lastFetchTime = now;
      }
    } catch (e) {
      console.warn('Live Config Fetch Failed:', e);
    }
  }

  try {
    console.log('[CardService] Fetching catalog data...');
    const catalog = await fetchCatalogData();
    if (!catalog) throw new Error('Catalog fetch empty');

    console.log(
      `[CardService] Mapping ${catalog.length} items from catalog...`
    );
    console.time('[Perf] cardService: map catalog');
    const cards = catalog.map((item) => normalizeLiteCard(item as any));
    console.timeEnd('[Perf] cardService: map catalog');
    console.log(`[CardService] Mapping complete: ${cards.length} cards.`);
    return cards;
  } catch (e) {
    console.error('Lite Collection Fetch Failed:', e);
    return [];
  }
};

export const getCardCharacterImage = (card: EnhancedCard): string => {
  if (card.cardType === 'SCHEME') {
    const normalizedName = card.name.trim().toUpperCase();
    return (
      localSchemeImages[normalizedName] ||
      card.custom?.characterImage ||
      card.image
    );
  }
  return card.custom?.characterImage || card.image || '';
};

export const getCardGroupKey = (card: EnhancedCard): string => {
  const category = card.category || 'Standard';
  const series = card.custom?.series || 'None';
  return `${card.name}-${card.rarity}-${category}-${series}`;
};

interface APICard {
  id: string;
  cardType: 'champion' | 'scheme' | 'other';
  cardName: string;
  rarity: 'basic' | 'rare' | 'epic' | 'legendary';
  rank: number;
  grade: number;
  tokenId?: number;
  cardId: number;
  mokiId?: string;
  ownerAddress?: string;
  imageUrl?: string;
  championTokenId?: number;
  serialized?: { id: number; max: number };
  seriesInfo?: { category: string; series: string; item: string };
  burned?: boolean;
  locked?: boolean;
  minted: boolean;
  updatedAt: string;
}

const capitalizeRarity = (rarity: string): string => {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
};

const mapCardType = (apiType: string): 'MOKI' | 'SCHEME' | 'OTHER' => {
  switch (apiType) {
    case 'champion':
      return 'MOKI';
    case 'scheme':
      return 'SCHEME';
    default:
      return 'OTHER';
  }
};

export const fetchUserCards = async (
  walletAddress: string,
  forceRefresh: boolean = false,
  isInitialAdd: boolean = false
): Promise<EnhancedCard[]> => {
  const now = Date.now();
  if (!cachedLiveData || now - lastFetchTime > CACHE_DURATION) {
    try {
      const live = await fetchLiveData();
      if (live) {
        cachedLiveData = live;
        lastFetchTime = now;
      }
    } catch (e) {
      console.warn('Live data fetch failed during user cards load:', e);
    }
  }

  let apiCards: APICard[] = [];
  const CACHE_KEY = `grandArena_userCards_${walletAddress}`;

  if (!forceRefresh && !isInitialAdd) {
    try {
      const cachedValue = await getFromDB(CACHE_KEY);
      if (cachedValue && typeof cachedValue === 'string') {
        apiCards = JSON.parse(cachedValue.replace(/season1-launch/gi, 'season1-v2'));
        console.log(`[CardService] Loaded ${apiCards.length} cards from idb cache for ${walletAddress}`);
      }
    } catch (e) {
      console.warn('[CardService] Failed to parse idb cache for user cards', e);
    }
  }

  if (apiCards.length === 0) {
    console.log(`[CardService] Fetching fresh cards for ${walletAddress} via paginated API...`);
    let fetching = true;
    let pageKey = '';
    
    while (fetching) {
      let fetchUrl = `/api/user-cards?address=${walletAddress}`;
      if (isInitialAdd) fetchUrl += '&initial=true';
      else if (forceRefresh) fetchUrl += '&force=true';
      
      if (pageKey) fetchUrl += `&pageKey=${encodeURIComponent(pageKey)}`;

      let retries = 0;
      let success = false;
      let jsonResponse: any;

      while (retries < 5 && !success) {
        try {
          const response = await fetch(fetchUrl);
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch user cards (${response.status})`);
          }
          jsonResponse = await response.json();
          success = true;
        } catch (err) {
          retries++;
          console.warn(`[CardService] Alchemy pagination failed, retrying (${retries}/5) in ${retries * 2}s...`, err);
          if (retries >= 5) {
            throw err;
          }
          await new Promise(r => setTimeout(r, retries * 2000));
        }
      }

      const newBatch = jsonResponse.data as APICard[];
      if (newBatch && newBatch.length > 0) {
        apiCards = apiCards.concat(newBatch);
      }

      if (jsonResponse.nextPageKey) {
        pageKey = jsonResponse.nextPageKey;
      } else {
        fetching = false;
      }
    }

    if (apiCards.length > 0) {
      try {
        await setInDB(CACHE_KEY, JSON.stringify(apiCards));
        console.log(`[CardService] Saved ${apiCards.length} cards to idb cache for ${walletAddress}`);
      } catch (e) {
        console.warn('[CardService] Failed to save cards to idb cache', e);
      }
    }
  }

  if (!apiCards || apiCards.length === 0) {
    return [];
  }

  const catalog = await fetchCatalogData();
  const catalogMap = new Map<string, { image: string; market: string }>();
  if (catalog) {
    catalog.forEach((item: any) => {
      const key = `${item.name.trim().toUpperCase()}|${item.rarity.toUpperCase()}`;
      catalogMap.set(key, { image: item.image, market: item.market || '' });
    });
  }

  // ── Diagnostic counters ─────────────────────────────────────────────────
  let diagNoApiImage = 0;
  let diagNoCatalogFallback = 0;
  let diagSpecialNoImage = 0;
  let diagNormalNoImage = 0;

  const mapped = apiCards
    .map((apiCard): EnhancedCard => {
      let normalizedName = apiCard.cardName.trim().toUpperCase();
      
      // Aggressively clean up prefixes/suffixes to ensure it matches catalog strings
      normalizedName = normalizedName
        .replace(/GRAND\s*ARENA(\s*-\s*)?/gi, '')
        .replace(/SCHEME(\s*-\s*)?/gi, '')
        .replace(/\s*#\d+$/g, '') 
        .replace(/\(.*\)/g, '')
        .trim();

      const cardType = mapCardType(apiCard.cardType);
      const rarity = capitalizeRarity(apiCard.rarity);
      const isSpecial = !!apiCard.seriesInfo;

      const catalogKey = `${normalizedName}|${rarity.toUpperCase()}`;
      let catalogData = catalogMap.get(catalogKey);
      
      // Fallback try without class suffixes if still not found
      if (!catalogData && normalizedName.includes(' - ')) {
        const splitName = normalizedName.split(' - ')[0].trim();
        catalogData = catalogMap.get(`${splitName}|${rarity.toUpperCase()}`);
      }

      // Diagnostic tracking
      if (!apiCard.imageUrl) {
        diagNoApiImage++;
        if (!catalogData?.image) {
          diagNoCatalogFallback++;
          if (isSpecial) diagSpecialNoImage++;
          else diagNormalNoImage++;
        }
      }

      const cardImage = apiCard.imageUrl || catalogData?.image || '';

      return buildEnhancedCard(
        apiCard.id,
        apiCard.cardName,
        rarity,
        cardType,
        cardImage,
        `${apiCard.cardName} - ${rarity}`,
        isSpecial,
        apiCard.seriesInfo,
        apiCard.championTokenId,
        catalogData?.market,
        apiCard
      );
    });

  const filtered = mapped.filter((card) => card.image && card.image.trim() !== '' && card.image !== '/favicon.ico');

  console.group('[CardService] Image Resolution Diagnostics');
  console.log(`Total from Alchemy:       ${apiCards.length}`);
  console.log(`After filter (displayed): ${filtered.length}`);
  console.log(`Dropped by filter:        ${apiCards.length - filtered.length}`);
  console.log(`  → No API imageUrl:      ${diagNoApiImage}`);
  console.log(`  → No catalog fallback:  ${diagNoCatalogFallback}`);
  console.log(`     → Special cards:     ${diagSpecialNoImage}`);
  console.log(`     → Normal cards:      ${diagNormalNoImage}`);
  console.groupEnd();

  return filtered;
};
