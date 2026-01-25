import { fetchLiveData, fetchCatalogData, LiveDataMap } from './liveData';

export interface CardAttribute {
    trait_type: string;
    value: string | number;
}

export interface GrandArenaCard {
    name: string;
    description: string;
    image: string;
    external_url: string;
    attributes: CardAttribute[];
}

export interface EnhancedCard extends GrandArenaCard {
    id: string;
    rarity: string;
    cardType: 'MOKI' | 'SCHEME';
    category?: string;
    locked?: boolean;
    custom: {
        stars: number;
        class?: string;
        fur?: string;
        series?: string;
        traits?: string[];
        eliminations?: number;
        deposits?: number;
        wartDistance?: number;
        score?: number;
        winRate?: number;
        imageUrl?: string;
        defense?: number;
        dexterity?: number;
        fortitude?: number;
        speed?: number;
        strength?: number;
        marketLink?: string;
    };
}

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
                console.log(`[LiteFetch] Loaded stats for ${Object.keys(live).length} champions.`);
            }
        } catch (e) {
            console.warn("Live Config Fetch Failed:", e);
        }
    }

    // 2. Fetch Catalog (Identity)
    try {
        const catalog = await fetchCatalogData();
        if (!catalog) throw new Error("Catalog fetch empty");

        console.log(`[LiteFetch] Found ${catalog.length} cards in catalog.`);
        const normalized = catalog.map(item => normalizeLiteCard(item));

        const matched = normalized.filter(c => c.custom.class).length;
        console.log(`[LiteFetch] Successfully matched stats for ${matched}/${catalog.length} cards.`);

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
const normalizeLiteCard = (catalogItem: { id: string, name: string, rarity: string, image: string, description?: string }): EnhancedCard => {
    const normalizedName = catalogItem.name.trim().toUpperCase();

    // Determine Card Type (Moki vs Scheme)
    // Schemes usually have names like "Beat the Buzzer", "Big Game Hunt", etc.
    // Or we can check if they are in the Stats Sheet?
    // Actually, Schemes aren't in the Stats Sheet usually.
    const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

    // A card is a SCHEME if its ID starts with 'Scheme' or matches the "space in name + no stats" heuristic
    const isScheme = catalogItem.id.toLowerCase().startsWith('scheme') || (normalizedName.includes(' ') && !stats);
    const cardType = isScheme ? 'SCHEME' : 'MOKI';

    return {
        id: catalogItem.id,
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
            imageUrl: catalogItem.image || stats?.imageUrl,
            defense: stats?.defense,
            dexterity: stats?.dexterity,
            fortitude: stats?.fortitude,
            speed: stats?.speed,
            strength: stats?.strength,
            marketLink: stats?.marketLink
        }
    };
};

export const getCardGroupKey = (card: EnhancedCard): string => {
    const category = card.category || 'Standard';
    const series = card.custom?.series || 'None';
    return `${card.name}-${card.rarity}-${category}-${series}`;
};
