import { fetchLiveData, fetchCatalogData, LiveDataMap } from './liveData';
import { EnhancedCard } from '@/types';

// Cache live data in memory
let cachedLiveData: LiveDataMap | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000;

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

    let cardImage = baseImage || stats?.imageUrl || '';

    // Determine market link
    let catalogMarketLink = '#';
    if (isSpecial) {
        const categoryObj = seriesInfo?.category?.toUpperCase() || '';
        if (categoryObj === 'FULL ART') {
            const seriesQuery = seriesInfo?.series ? encodeURIComponent(seriesInfo.series) : '';
            catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Series=${seriesQuery}`;
        } else if (categoryObj === 'OVERLAY' || categoryObj === 'BORDER') {
            const seriesQuery = seriesInfo?.series ? encodeURIComponent(seriesInfo.series) : '';
            if (championTokenId !== undefined) {
                catalogMarketLink = `https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b?Champion%20Token%20ID_max=${championTokenId}&Champion%20Token%20ID_min=${championTokenId}&Series=${seriesQuery}`;
            }
        } else {
            catalogMarketLink = '#';
        }
    } else {
        catalogMarketLink = catalogMarket || '#';
    }

    const characterImage = localSchemeImages[normalizedName] || stats?.imageUrl || cardImage;

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
            series: seriesInfo?.series,
            catalogMarketLink: catalogMarketLink,
        },
        category: seriesInfo?.category
    };
};

const normalizeLiteCard = (catalogItem: { id: string, name: string, rarity: string, image: string, description?: string, market?: string }): EnhancedCard => {
    const normalizedName = catalogItem.name.trim().toUpperCase();
    const stats = cachedLiveData ? cachedLiveData[normalizedName] : null;

    const isScheme = catalogItem.id.toLowerCase().startsWith('scheme') || (normalizedName.includes(' ') && !stats);
    const cardType = isScheme ? 'SCHEME' : 'MOKI';
    const id = isScheme ? `Scheme-${catalogItem.name}` : catalogItem.id;
    const desc = catalogItem.description || `Grand Arena Lite - ${catalogItem.name}`;

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
    console.log("[CardService] Starting lite collection fetch...");
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

    try {
        console.log("[CardService] Fetching catalog data...");
        const catalog = await fetchCatalogData();
        if (!catalog) throw new Error("Catalog fetch empty");

        console.log(`[CardService] Mapping ${catalog.length} items from catalog...`);
        const cards = catalog.map(item => normalizeLiteCard(item as any));
        console.log(`[CardService] Mapping complete: ${cards.length} cards.`);
        return cards;
    } catch (e) {
        console.error("Lite Collection Fetch Failed:", e);
        return [];
    }
};

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
        case 'champion': return 'MOKI';
        case 'scheme': return 'SCHEME';
        default: return 'OTHER';
    }
};

export const fetchUserCards = async (walletAddress: string, forceRefresh: boolean = false): Promise<EnhancedCard[]> => {
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

    const catalog = await fetchCatalogData();
    const catalogMap = new Map<string, { image: string, market: string }>();
    if (catalog) {
        catalog.forEach((item: any) => {
            const key = `${item.name.trim().toUpperCase()}|${item.rarity.toUpperCase()}`;
            catalogMap.set(key, { image: item.image, market: item.market || '' });
        });
    }

    return apiCards.map((apiCard): EnhancedCard => {
        const normalizedName = apiCard.cardName.trim().toUpperCase();
        const cardType = mapCardType(apiCard.cardType);
        const rarity = capitalizeRarity(apiCard.rarity);
        const isSpecial = !!apiCard.seriesInfo;

        const catalogKey = `${normalizedName}|${rarity.toUpperCase()}`;
        const catalogData = catalogMap.get(catalogKey);

        let cardImage = apiCard.imageUrl || catalogData?.image || '';

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
};
