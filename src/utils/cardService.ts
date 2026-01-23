
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
        if (balance === 0) return [];

        await contract.tokenOfOwnerByIndex(address, 0);

        const promises = [];
        for (let i = 0; i < balance; i++) {
            promises.push(contract.tokenOfOwnerByIndex(address, i));
        }
        const tokenIds = await Promise.all(promises);
        ids = tokenIds.map(t => t.toString());
        console.log(`[1] Success! Found IDs via Contract:`, ids);

    } catch (err: any) {
        console.warn(`[1] Contract Enumeration Failed:`, err.code || err.message);

        // STRATEGY 2: Sky Mavis GraphQL (Marketplace API)
        try {
            console.log(`[2] Trying Sky Mavis GraphQL (${GRAPHQL_ENDPOINT})...`);
            ids = await fetchIdsViaGraphQL(address);
            console.log(`[2] Success! Found IDs via GraphQL:`, ids);
        } catch (gqlErr) {
            console.error(`[2] GraphQL Failed:`, gqlErr);

            // STRATEGY 3: Fallback Mock
            console.warn(`[3] Falling back to Mock Data.`);
            alert("Could not fetch real data (Contract not enumerable & API error). Showing Mock Data.");
            return mockToEnhanced(MOCK_GRAND_ARENA_CARDS);
        }
    }

    if (ids.length === 0 && ids !== undefined) return [];

    const cards = await Promise.all(ids.map(fetchCardMetadata));
    return cards.filter(c => c !== null) as EnhancedCard[];
};

// -- Helpers --

async function fetchIdsViaGraphQL(owner: string): Promise<string[]> {
    const formattedOwner = owner.startsWith('ronin:') ? owner.replace('ronin:', '0x') : owner;

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

    const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            query,
            variables: {
                from: 0,
                size: 50,
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

    return json.data?.erc721Tokens?.results?.map((t: any) => t.tokenId) || [];
}

async function fetchCardMetadata(id: string): Promise<EnhancedCard | null> {
    try {
        const response = await fetch(`/api/metadata?id=${id}`);
        if (!response.ok) return null;
        const data: GrandArenaCard = await response.json();
        return normalizeCard(data, id);
    } catch (e) {
        console.error(`Metadata error ${id}`, e);
        return null;
    }
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
