
// We duplicate the interfaces/constants here to avoid complex imports in the worker scope
// which can cause issues with Next.js webpack configuration for workers.

export interface EnhancedCard {
    id: string;
    name: string;
    rarity: string;
    cardType: 'MOKI' | 'SCHEME';
    custom: {
        stars: number;
        class?: string;
        fur?: string;
        traits?: string[];
        eliminations?: number;
        deposits?: number;
        wartDistance?: number;
        score?: number;
        winRate?: number;
    };
}

export interface FilterState {
    rarity: string[];
    cardType: 'ALL' | 'MOKI' | 'SCHEME';
    schemeName: string[];
    fur: string[];
    stars: number[];
    customClass: string[];
    specialization: string[];
    traits: string[];
    insertionOrder?: string[];
    onlyEpicLegendary?: boolean;
}

const TRAIT_GROUPS: { label: string, traits: string[] }[] = [
    { label: "Ronin or Samurai", traits: ["Ronin", "Samurai"] },
    { label: "Pink, Blue or Green Overalls", traits: ["Pink Overalls", "Blue Overalls", "Green Overalls"] },
    { label: "Tongue Out", traits: ["Tongue Out"] },
    { label: "Tanuki, Kitsune or Cat Mask", traits: ["Tanuki", "Kitsune", "Cat Mask"] },
    { label: "Devious Mouth", traits: ["Devious Mouth"] },
    { label: "Oni, Tengu or Skull Mask", traits: ["Oni", "Tengu", "Skull Mask"] },
    { label: "Apron, Garbage/Gold Can or Toilet Paper", traits: ["Apron", "Garbage Can", "Gold Can", "Toilet Paper"] },
    { label: "Crying Eye", traits: ["Crying Eye"] },
    { label: "Onesie", traits: ["Onesie"] },
    { label: "Lemon, Kappa, Tomato, Bear, Frog or Blob Head", traits: ["Lemon", "Kappa", "Tomato", "Bear", "Frog", "Blob Head"] },
    { label: "Kimono", traits: ["Kimono"] }
];

const matchesFilter = (
    card: EnhancedCard,
    filters: FilterState,
    searchQuery: string = ''
): boolean => {
    // 0. Search Query (Name Match)
    if (searchQuery.length > 0) {
        const query = searchQuery.trim().toLowerCase();
        const cardName = card.name.trim().toLowerCase();
        if (!cardName.includes(query)) return false;
    }

    // 1. Card Type Filter
    if (filters.cardType !== 'ALL') {
        if (card.cardType !== filters.cardType) return false;
    }

    // 4. Scheme Name Filter
    if (filters.schemeName.length > 0) {
        if (!filters.schemeName.includes(card.name)) return false;
    }

    // 5. Custom Filters (Moki)
    const isSchemeMode = filters.cardType === 'SCHEME';

    if (card.cardType === 'SCHEME') {
        if (isSchemeMode) {
            return true;
        }
        // Fall through for ALL mode
    }

    // --- EVERYTHING BELOW APPLIES ONLY TO MOKI CARDS OR ALL MODE SCHEME FILTERING ---

    // 1.5 Enforce Epic/Legendary Universe
    if (filters.onlyEpicLegendary) {
        if (card.rarity !== 'Epic' && card.rarity !== 'Legendary') return false;
    }

    // 2. Rarity Filter
    if (filters.rarity.length > 0 && !filters.rarity.includes(card.rarity)) return false;

    // FUR
    if (filters.fur.length > 0) {
        if (!card.custom.fur || !filters.fur.includes(card.custom.fur)) return false;
    }
    // STARS
    if (filters.stars.length > 0) {
        if (!filters.stars.includes(card.custom.stars)) return false;
    }
    // CLASS (Custom)
    if (filters.customClass.length > 0) {
        if (!card.custom.class || !filters.customClass.includes(card.custom.class)) return false;
    }
    // SPECIALIZATION
    if (filters.specialization.length > 0) {
        const hasSpec = filters.specialization.some(spec => {
            switch (spec) {
                case 'Gacha':
                    return (card.custom.deposits ?? 0) >= 4.75;
                case 'Killer':
                    return (card.custom.eliminations ?? 0) >= 1.50;
                case 'Wart Rider':
                    return (card.custom.wartDistance ?? 0) >= 170;
                case 'Winner':
                    return (card.custom.winRate ?? 0) >= 53.5;
                case 'Loser':
                    if (card.custom.winRate === undefined || card.custom.winRate === null) return false;
                    return card.custom.winRate <= 47.5;
                default:
                    return false;
            }
        });
        if (!hasSpec) return false;
    }
    // TRAITS
    if (filters.traits.length > 0) {
        if (!card.custom.traits) return false;

        const activeTraits = filters.traits.flatMap(label => {
            const group = TRAIT_GROUPS.find(g => g.label === label);
            return group ? group.traits : [];
        });

        const hasTrait = activeTraits.some(t => card.custom.traits?.includes(t));
        if (!hasTrait) return false;
    }

    return true;
};

// Event Listener for the Worker
self.onmessage = (e: MessageEvent) => {
    const { allCards, filters, searchQuery } = e.data;

    // Perform Filtering
    const filtered = allCards.filter((card: EnhancedCard) => matchesFilter(card, filters, searchQuery));

    // Send back results
    self.postMessage(filtered);
};
