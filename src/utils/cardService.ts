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
        characterImage?: string;
        defense?: number;
        dexterity?: number;
        fortitude?: number;
        speed?: number;
        strength?: number;
        totalStats?: number;
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

    // Local overrides for minimized version (characterImage) of specific Scheme cards
    const localSchemeImages: { [key: string]: string } = {
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

    const characterImage = localSchemeImages[normalizedName] || stats?.imageUrl || catalogItem.image;

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
            characterImage: characterImage,
            defense: stats?.defense,
            dexterity: stats?.dexterity,
            fortitude: stats?.fortitude,
            speed: stats?.speed,
            strength: stats?.strength,
            totalStats: stats?.totalStats,
            marketLink: stats?.marketLink
        }
    };
};

export const getCardGroupKey = (card: EnhancedCard): string => {
    const category = card.category || 'Standard';
    const series = card.custom?.series || 'None';
    return `${card.name}-${card.rarity}-${category}-${series}`;
};
