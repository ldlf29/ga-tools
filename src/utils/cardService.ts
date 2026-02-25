import { fetchLiveData, fetchCatalogData, LiveDataMap } from './liveData';
import { EnhancedCard } from '@/types';
import promoCards from '@/data/promoCards.json';

// Cache live data in memory
let cachedLiveData: LiveDataMap | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000;

/**
 * Lite Version: Fetches the full static collection (720 cards)
 */
export const fetchLiteCollection = async (): Promise<EnhancedCard[]> => {
    // 1. Fetch Live Data (Stats)
    const now = Date.now();
    if (!cachedLiveData || (now - lastFetchTime > CACHE_DURATION)) {
        try {
            const live = await fetchLiveData();
            if (live) {
                cachedLiveData = live;
                lastFetchTime = now;
            }
        } catch (e) {
            console.warn("Live Config Fetch Failed:", e);
        }
    }

    // 2. Fetch Catalog (Identity)
    try {
        const catalog = await fetchCatalogData();
        if (!catalog) throw new Error("Catalog fetch empty");

        const normalized = catalog.map(item => normalizeLiteCard(item as any));

        const matched = normalized.filter(c => c.custom.class).length;


        return normalized;
    } catch (e) {
        console.error("Lite Collection Fetch Failed:", e);
        return [];
    }
};

/**
 * Normalizes a row from the Catalog Sheet into an EnhancedCard
 * Merges with stats from the Stats Sheet using the card Name.
 */
export const localSchemeImages: { [key: string]: string } = {
    'AGGRESSIVE SPECIALIZATION': '/scheme/aggressive specialization.png',
    'BAITING THE TRAP': '/scheme/baiting the trap.png',
    'BEAT THE BUZZER': '/scheme/beat the buzzer.png',
    'BIG GAME HUNT': '/scheme/big game hunt.png',
    'CAGE MATCH': '/scheme/cage match.png',
    'CALL TO ARMS': '/scheme/call to arms.png',
    'COLLECT EM ALL': '/scheme/collect em all.png',
    'COLLECT \'EM ALL': '/scheme/collect em all.png',
    'COLLECTIVE SPECIALIZATION': '/scheme/collective specialization.png',
    'COSTUME PARTY': '/scheme/costume party.png',
    'CURSED DINNER': '/scheme/cursed dinner.png',
    'DIVINE INTERVENTION': '/scheme/divine intervention.png',
    'DRESS TO IMPRESS': '/scheme/dress to impress.png',
    'DUNGAREE DUEL': '/scheme/dungaree duel.png',
    'ENFORCING THE NAUGHTY LIST': '/scheme/enforcing the naughty list.png',
    'FINAL BLOW': '/scheme/final blow.png',
    'FLEXING': '/scheme/flexing.png',
    'GACHA GOUGING': '/scheme/gacha gouging.png',
    'GACHA HOARDING': '/scheme/gacha hoarding.png',
    'GOLDEN SHOWER': '/scheme/golden shower.png',
    'GRABBING BALLS': '/scheme/grabbing balls.png',
    'HOUSEKEEPING': '/scheme/housekeeping.png',
    'LITTER COLLECTION': '/scheme/litter collection.png',
    'MALICIOUS INTENT': '/scheme/malicious intent.png',
    'MIDNIGHT STRIKE': '/scheme/midnight strike.png',
    'MOKI SMASH': '/scheme/moki smash.png',
    'RAINBOW RIOT': '/scheme/rainbow riot.png',
    'RUNNING INTERFERENCE': '/scheme/running interference.png',
    'SACCING': '/scheme/saccing.png',
    'SHAPESHIFTING': '/scheme/shapeshifting.png',
    'TAKING A DIVE': '/scheme/taking a dive.png',
    'TEAR JERKING': '/scheme/tear jerking.png',
    'TOUCHING THE WART': '/scheme/touching the wart.png',
    'VICTORY LAP': '/scheme/victory lap.png',
    'WART RODEO': '/scheme/wart rodeo.png',
    'WHALE WATCHING': '/scheme/whale watching.png'
};

const normalizeLiteCard = (catalogItem: { id: string, name: string, rarity: string, image: string, description?: string, market?: string }): EnhancedCard => {
    const normalizedName = catalogItem.name.trim().toUpperCase();

    // Determine Card Type (Moki vs Scheme)
    // Schemes usually have names like "Beat the Buzzer", "Big Game Hunt", etc.
    // Or we can check if they are in the Stats Sheet?
    // Actually, Schemes aren't in the Stats Sheet usually.
    const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

    // A card is a SCHEME if its ID starts with 'Scheme' or matches the "space in name + no stats" heuristic
    const isScheme = catalogItem.id.toLowerCase().startsWith('scheme') || (normalizedName.includes(' ') && !stats);
    const cardType = isScheme ? 'SCHEME' : 'MOKI';

    const characterImage = localSchemeImages[normalizedName] || stats?.imageUrl || catalogItem.image;

    return {
        id: isScheme ? `Scheme-${catalogItem.name}` : catalogItem.id,
        name: catalogItem.name,
        description: catalogItem.description || `Grand Arena Lite - ${catalogItem.name}`,
        image: catalogItem.image || (stats?.imageUrl) || '',
        external_url: stats?.marketLink || '',
        rarity: catalogItem.rarity || 'Basic',
        cardType,
        attributes: [
            { trait_type: 'Rarity', value: catalogItem.rarity },
            { trait_type: 'Card Type', value: cardType }
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
            imageUrl: catalogItem.image || stats?.imageUrl,
            characterImage: characterImage,
            defense: stats?.defense,
            dexterity: stats?.dexterity,
            fortitude: stats?.fortitude,
            speed: stats?.speed,
            strength: stats?.strength,
            totalStats: stats?.totalStats,
            train: stats?.train,
            marketLink: stats?.marketLink,
            catalogMarketLink: catalogItem.market
        }
    };
};

/**
 * Gets the best image for minimized/portrait views.
 * Prioritizes local scheme images if it's a scheme card.
 */
export const getCardCharacterImage = (card: EnhancedCard): string => {
    if (card.cardType === 'SCHEME') {
        const normalizedName = card.name.trim().toUpperCase();
        return localSchemeImages[normalizedName] || card.custom?.characterImage || card.image;
    }
    return card.custom?.characterImage || card.image || '';
};

export const getCardGroupKey = (card: EnhancedCard): string => {
    const category = card.category || 'Standard';
    const series = card.custom?.series || 'None';
    return `${card.name}-${card.rarity}-${category}-${series}`;
};

/**
 * API Card type from our proxy route
 */
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

/**
 * Capitalizes rarity from API format ("basic" → "Basic")
 */
const capitalizeRarity = (rarity: string): string => {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1).toLowerCase();
};

/**
 * Maps API cardType to our internal format
 */
const mapCardType = (apiType: string): 'MOKI' | 'SCHEME' | 'OTHER' => {
    switch (apiType) {
        case 'champion': return 'MOKI';
        case 'scheme': return 'SCHEME';
        default: return 'OTHER';
    }
};

/**
 * Fetches user cards from our API proxy and merges with existing stats data.
 * Special card images are enriched server-side by the proxy (via NFT endpoint).
 * @param walletAddress The user's wallet address.
 * @param forceRefresh If true, forces a network fetch for fresh cards bypassing local cache.
 */
export const fetchUserCards = async (walletAddress: string, forceRefresh: boolean = false): Promise<EnhancedCard[]> => {
    // Ensure live data is loaded (for stats merge)
    const now = Date.now();
    if (!cachedLiveData || (now - lastFetchTime > CACHE_DURATION)) {
        try {
            const live = await fetchLiveData();
            if (live) {
                cachedLiveData = live;
                lastFetchTime = now;
            }
        } catch (e) {
            console.warn("Live data fetch failed during user cards load:", e);
        }
    }

    let apiCards: APICard[] = [];
    const CACHE_KEY = `grandArena_userCards_${walletAddress}`;

    // 1. Attempt to load from localStorage first unless forced to refresh
    if (!forceRefresh) {
        try {
            const cachedValue = localStorage.getItem(CACHE_KEY);
            if (cachedValue) {
                apiCards = JSON.parse(cachedValue);
                console.log(`[CardService] Loaded ${apiCards.length} cards from local cache for ${walletAddress}`);
            }
        } catch (e) {
            console.warn("[CardService] Failed to parse local cache for user cards", e);
        }
    }

    // 2. Fetch from API if cache was empty, invalid, or ignored
    if (apiCards.length === 0) {
        console.log(`[CardService] Fetching fresh cards for ${walletAddress} from API...`);
        const fetchUrl = forceRefresh
            ? `/api/user-cards?address=${walletAddress}&force=true`
            : `/api/user-cards?address=${walletAddress}`;

        const response = await fetch(fetchUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch user cards (${response.status})`);
        }

        const jsonResponse = await response.json();
        apiCards = jsonResponse.data as APICard[];

        // 3. Save new fetch to LocalStorage
        if (apiCards) {
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(apiCards));
                console.log(`[CardService] Saved ${apiCards.length} cards to local cache for ${walletAddress}`);
            } catch (e) {
                console.warn("[CardService] Failed to save cards to local cache", e);
            }
        }
    }

    if (!apiCards || apiCards.length === 0) {
        return [];
    }

    // Build catalog lookup map: "NAME_UPPER|Rarity" → { image, market }
    const catalog = await fetchCatalogData();
    const catalogMap = new Map<string, { image: string, market: string }>();
    if (catalog) {
        catalog.forEach((item: any) => {
            const key = `${item.name.trim().toUpperCase()}|${item.rarity.toUpperCase()}`;
            catalogMap.set(key, { image: item.image, market: item.market || '' });
        });
    }

    // Transform API cards to EnhancedCard
    return apiCards.map((apiCard): EnhancedCard => {
        const normalizedName = apiCard.cardName.trim().toUpperCase();
        const cardType = mapCardType(apiCard.cardType);
        const rarity = capitalizeRarity(apiCard.rarity);
        const isScheme = cardType === 'SCHEME';
        const isSpecial = !!apiCard.seriesInfo;

        // Look up stats from existing live data
        const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

        // Resolve image: always use proxy (Alchemy) image first, fallback to catalog if missing
        const catalogKey = `${normalizedName}|${rarity.toUpperCase()}`;

        // Debug specific cards
        const debugNames = ['NOMAD', 'BUTTHOLE MOKI', 'MAHOSHOJO', 'GRUYERE', 'KINGOFRATZ'];
        const isDebugTarget = debugNames.some(n => normalizedName.includes(n));

        const catalogData = catalogMap.get(catalogKey);
        let cardImage = apiCard.imageUrl || catalogData?.image || '';

        // Determine market link
        let catalogMarketLink = '#';
        if (isSpecial) {
            const categoryObj = apiCard.seriesInfo?.category?.toUpperCase() || '';
            if (categoryObj === 'FULL ART') {
                const seriesQuery = apiCard.seriesInfo?.series ? encodeURIComponent(apiCard.seriesInfo.series) : '';
                catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Series=${seriesQuery}`;
            } else if (categoryObj === 'OVERLAY' || categoryObj === 'BORDER') {
                const seriesQuery = apiCard.seriesInfo?.series ? encodeURIComponent(apiCard.seriesInfo.series) : '';
                if (apiCard.championTokenId !== undefined) {
                    catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Champion%20Token%20ID_max=${apiCard.championTokenId}&Champion%20Token%20ID_min=${apiCard.championTokenId}&Series=${seriesQuery}`;
                }
            } else {
                catalogMarketLink = '#';
            }
        } else {
            catalogMarketLink = catalogData?.market || '#';
        }

        if (isDebugTarget) {
            console.log(`[Frontend] ${normalizedName} Image source: ${apiCard.imageUrl ? 'Alchemy' : 'Catalog'}, URL: ${cardImage}`);
        }

        // Override for specific Full Art Promo Cards
        // User request update: series is "Presale Promo", not "Promo Card"
        if (apiCard.seriesInfo?.category === "Full Art" && (apiCard.seriesInfo?.series === "Presale Promo" || apiCard.seriesInfo?.series === "Promo Card")) {
            const promoId = apiCard.seriesInfo.item;
            if (promoId && (promoCards as Record<string, string>)[promoId]) {
                cardImage = (promoCards as Record<string, string>)[promoId];
                if (isDebugTarget) console.log(`[Frontend] ${normalizedName} OVERRIDE with Promo Image: ${cardImage}`);
            }
        }

        // Character image (portrait/minimized version)
        // FORCE Scheme images from local map if available
        const characterImage = localSchemeImages[normalizedName] || stats?.imageUrl || cardImage;

        return {
            id: apiCard.id,
            name: apiCard.cardName,
            description: `${apiCard.cardName} - ${rarity}`,
            image: cardImage,
            external_url: stats?.marketLink || '',
            rarity,
            cardType,
            tokenId: apiCard.tokenId,
            serializedId: apiCard.serialized?.id,
            serializedMax: apiCard.serialized?.max,
            seriesCategory: apiCard.seriesInfo?.category,
            seriesInfo: apiCard.seriesInfo,
            isSpecial,
            attributes: [
                { trait_type: 'Rarity', value: rarity },
                { trait_type: 'Card Type', value: cardType }
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
                imageUrl: cardImage,
                characterImage,
                defense: stats?.defense,
                dexterity: stats?.dexterity,
                fortitude: stats?.fortitude,
                speed: stats?.speed,
                strength: stats?.strength,
                totalStats: stats?.totalStats,
                train: stats?.train,
                marketLink: stats?.marketLink,
                series: apiCard.seriesInfo?.series,
                catalogMarketLink: catalogMarketLink,
            },
            category: apiCard.seriesInfo?.category
        };
    });
};
