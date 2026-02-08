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
        train?: number;
        marketLink?: string;
        catalogMarketLink?: string;
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

export const TRAIT_GROUPS = [
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

export interface SavedLineup {
    id: number;
    name: string;
    cards: EnhancedCard[];
    createdAt: number;
    isFavorite?: boolean;
    favoritedAt?: number;
    rating?: number; // 1-5
    backgroundId?: string; // ID of the selected background
}
