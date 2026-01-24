
import { ethers } from 'ethers';

import { MOCK_GRAND_ARENA_CARDS } from '@/data/mockGrandArenaCards';
import { fetchLiveData, LiveDataMap } from './liveData';

// Official Marketplace GraphQL (Researched)
const GRAPHQL_ENDPOINT = 'https://marketplace-graphql.skymavis.com/graphql';

const RONIN_RPC_URL = 'https://api.roninchain.com/rpc';
const CONTRACT_ADDRESS = '0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b';

// Minimal ABI
const ABI_ENUMERABLE = [
    "function balanceOf(address owner) view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)"
];

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
    };
}

// Cache live data in memory during session
let cachedLiveData: LiveDataMap | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; // 1 minute cache

export const fetchUserCards = async (address: string): Promise<EnhancedCard[]> => {
    // 0. Fetch Live Data (if stale)
    const now = Date.now();
    if (!cachedLiveData || (now - lastFetchTime > CACHE_DURATION)) {
        try {
            console.log("Fetching Live Config...");
            const live = await fetchLiveData();
            if (live) {
                cachedLiveData = live;
                lastFetchTime = now;
                console.log("Live Config Updated:", Object.keys(live).length, "entries");
            }
        } catch (e) {
            console.warn("Live Config Fetch Failed, using fallback:", e);
        }
    }

    let ids: string[] = [];

    // STRATEGY 1: Contract Enumeration (Standard ERC721)
    try {
        console.log(`[1] Trying Contract Enumeration on ${RONIN_RPC_URL}...`);
        const provider = new ethers.JsonRpcProvider(RONIN_RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI_ENUMERABLE, provider);

        const balance = Number(await contract.balanceOf(address));
        console.log(`[1] Balance found: ${balance}`);

        if (balance === 0) return [];
        if (balance > 2500) throw new Error("Collection too large for RPC enumeration, try GraphQL");

        // Batch processing to avoid 429 Rate Limits
        const BATCH_SIZE = 50;
        const tokenIds: any[] = [];

        for (let i = 0; i < balance; i += BATCH_SIZE) {
            const batchPromises = [];
            const end = Math.min(i + BATCH_SIZE, balance);

            for (let j = i; j < end; j++) {
                batchPromises.push(contract.tokenOfOwnerByIndex(address, j));
            }

            console.log(`[1] Fetching batch ${i} to ${end}...`);
            const batchResults = await Promise.all(batchPromises);
            tokenIds.push(...batchResults);

            // Small delay to be nice to RPC
            await new Promise(r => setTimeout(r, 100));
        }

        ids = tokenIds.map(t => t.toString());
        console.log(`[1] Success! Found IDs via Contract:`, ids.length);

    } catch (err: any) {
        console.warn(`[1] Contract Enumeration Failed:`, err.code || err.message);

        // STRATEGY 2: Sky Mavis GraphQL (Marketplace API)
        try {
            console.log(`[2] Trying Sky Mavis GraphQL (${GRAPHQL_ENDPOINT})...`);
            ids = await fetchIdsViaGraphQL(address);
            console.log(`[2] Success! Found IDs via GraphQL:`, ids.length);
        } catch (gqlErr) {
            console.error(`[2] GraphQL Failed:`, gqlErr);

            // STRATEGY 3: Fallback Mock
            console.warn(`[3] Falling back to Mock Data.`);
            // Only alert if we really have no data and it wasn't a 0 balance issue
            if (ids.length === 0) {
                alert("Could not fetch real data. Network/API issues. Showing Mock Data.");
                return mockToEnhanced(MOCK_GRAND_ARENA_CARDS);
            }
        }
    }

    if (ids.length === 0 && ids !== undefined) return [];

    // Sequential metadata fetching to avoid 429s
    const cards: EnhancedCard[] = [];
    console.log(`[Metadata] Starting fetch for ${ids.length} cards...`);

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const card = await fetchCardMetadataWithRetry(id);
        if (card) cards.push(card);

        if (i % 10 === 0) {
            console.log(`[Metadata] Progress: ${i}/${ids.length}`);
        }
    }

    return cards;
};

// -- Helpers --

async function fetchIdsViaGraphQL(owner: string): Promise<string[]> {
    const formattedOwner = owner.startsWith('ronin:') ? owner.replace('ronin:', '0x') : owner;
    let allIds: string[] = [];
    let from = 0;
    const size = 50; // Safer batch size
    let hasMore = true;

    while (hasMore) {
        const query = `
        query GetOwnerTokens($from: Int!, $size: Int!, $owner: String!, $tokenAddress: String!) {
          erc721Tokens(from: $from, size: $size, owner: $owner, tokenAddress: $tokenAddress) {
            results {
              tokenId
            }
            total
          }
        }
        `;

        const response = await fetch('/api/proxy-graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                query,
                variables: {
                    from,
                    size,
                    owner: formattedOwner,
                    tokenAddress: CONTRACT_ADDRESS
                }
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Status ${response.status}: ${text}`);
        }

        const json = await response.json();
        if (json.errors) {
            throw new Error(`Query Error: ${JSON.stringify(json.errors)}`);
        }

        const results = json.data?.erc721Tokens?.results?.map((t: any) => t.tokenId) || [];
        allIds = [...allIds, ...results];

        console.log(`[GraphQL] Fetched ${results.length} items (Total: ${allIds.length})`);

        if (results.length < size) {
            hasMore = false;
        } else {
            from += size;
            // Safety break
            if (from > 5000) hasMore = false;
        }
    }

    return allIds;
}

async function fetchCardMetadataWithRetry(id: string, retries = 5): Promise<EnhancedCard | null> {
    const cacheKey = `ga_metadata_v1_${id}`;

    // 1. Check LocalStorage Cache
    if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                const rawData = JSON.parse(cached);
                return normalizeCard(rawData, id);
            } catch (e) {
                localStorage.removeItem(cacheKey);
            }
        }
    }

    // 2. Fetch if not in cache
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(`/api/metadata?id=${id}`);

            if (response.status === 429) {
                // Exponential Backoff
                const delay = 2000 * Math.pow(2, i);
                console.warn(`[429] Rate Limit on ${id}. Retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            if (!response.ok) return null;

            const rawData: GrandArenaCard = await response.json();

            // Save to Cache
            if (typeof window !== 'undefined') {
                localStorage.setItem(cacheKey, JSON.stringify(rawData));
            }

            return normalizeCard(rawData, id);
        } catch (e) {
            console.error(`Metadata error ${id} (Attempt ${i + 1})`, e);
            if (i === retries - 1) return null;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    return null;
}

async function fetchCardMetadata(id: string): Promise<EnhancedCard | null> {
    return fetchCardMetadataWithRetry(id);
}


const normalizeCard = (rawCard: GrandArenaCard, tokenId: string): EnhancedCard => {
    const rarityAttr = rawCard.attributes?.find(a => a.trait_type === 'Rarity');
    const typeAttr = rawCard.attributes?.find(a => a.trait_type === 'Card Type');
    const catAttr = rawCard.attributes?.find(a => a.trait_type === 'Category');

    let cardType = (typeAttr?.value as string || 'MOKI').toUpperCase();
    if (cardType === 'AUGMENT') cardType = 'SCHEME';

    // Normalize name for lookup (Basic Case Insensitive)
    const normalizedName = rawCard.name.trim().toUpperCase(); // Force Upper for keys

    // PRIORITY 1: Live Data (Google Sheet)
    let dynamicData: any = {};
    if (cachedLiveData && cachedLiveData[normalizedName]) {
        dynamicData = cachedLiveData[normalizedName];
    } else {
        dynamicData = {};
    }

    // Debug Log only for Moki to verify matching
    if (cardType === 'MOKI') {
        // console.log(`Processing MOKI: ${normalizedName}. Found Custom Data?`, !!customKey, customData);
    }

    return {
        ...rawCard,
        id: tokenId,
        rarity: String(rarityAttr?.value || 'Basic'),
        cardType: cardType as 'MOKI' | 'SCHEME',
        category: catAttr ? String(catAttr.value) : undefined,
        custom: {
            stars: dynamicData.stars || 0,
            class: dynamicData.class,
            fur: dynamicData.fur,
            series: rawCard.attributes?.find(a => a.trait_type === 'Series')?.value as string | undefined,
            traits: dynamicData.traits || [],
            eliminations: dynamicData.eliminations,
            deposits: dynamicData.deposits,
            wartDistance: dynamicData.wartDistance,
            score: dynamicData.score,
            winRate: dynamicData.winRate,
            imageUrl: dynamicData.imageUrl,
            defense: dynamicData.defense,
            dexterity: dynamicData.dexterity,
            fortitude: dynamicData.fortitude,
            speed: dynamicData.speed,
            strength: dynamicData.strength
        }
    };
};

const mockToEnhanced = (mockCards: any[]): EnhancedCard[] => {
    return mockCards.map((c, i) => normalizeCard(c, c.attributes.find((a: any) => a.trait_type.includes('Token ID'))?.value || `mock-${i}`));
};

export const getCardGroupKey = (card: EnhancedCard): string => {
    const category = card.category || 'Standard';
    const series = card.custom?.series || 'None';
    return `${card.name}-${card.rarity}-${category}-${series}`;
};
