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
  cardType: 'MOKI' | 'SCHEME' | 'OTHER';
  category?: string;
  locked?: boolean;
  tokenId?: number;
  serializedId?: number;
  serializedMax?: number;
  seriesCategory?: string;
  seriesInfo?: { category: string; series: string; item: string };
  isSpecial?: boolean;
  stackCount?: number; // total copies owned
  stackAvailable?: number; // copies not yet used (total - in lineup - in saved lineups)
  stackedIds?: string[]; // all card IDs in this stack
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
    traitSchemes?: string[];  // e.g. ['Call to Arms', 'Dungaree Duel']
    avgEliminations?: number;
    avgDeposits?: number;
    avgWartDistance?: number;
    avgScore?: number;
    avgWinRate?: number;
    avgEliminations10?: number;
    avgDeposits10?: number;
    avgWartDistance10?: number;
    avgScore10?: number;
    avgWinRate10?: number;
    avgEliminations20?: number;
    avgDeposits20?: number;
    avgWartDistance20?: number;
    avgScore20?: number;
    avgWinRate20?: number;

    avgEndedGame10?: number;
    avgDeaths10?: number;
    avgEatingWhileRiding10?: number;
    avgBuffTime10?: number;
    avgWartTime10?: number;
    avgLooseBallPickups10?: number;
    avgEatenByWart10?: number;
    avgWartCloser10?: number;
    avgEndedGame20?: number;
    avgDeaths20?: number;
    avgEatingWhileRiding20?: number;
    avgBuffTime20?: number;
    avgWartTime20?: number;
    avgLooseBallPickups20?: number;
    avgEatenByWart20?: number;
    avgWartCloser20?: number;

  };
}

export interface ConnectedWallet {
  address: string;
  addedAt: number;
  lastRefresh: number;
}

export interface FilterState {
  rarity: string[];
  cardType: 'MOKI' | 'SCHEME';
  schemeName: string[];
  fur: string[];
  stars: number[];
  customClass: string[];
  specialization: string[];
  traits: string[];
  traitScheme: string[];
  insertionOrder?: string[];
  matchLimit?: 10 | 20 | 'ALL';
  extraSort?: string;
}

export const TRAIT_GROUPS = [
  {
    label: 'Ronin or Samurai',
    traits: ['Ronin', 'Samurai', 'Ronin Aurora', 'Ronin Moon'],
  },
  {
    label: 'Pink, Blue or Green Overalls',
    traits: ['Pink Overalls', 'Blue Overalls', 'Green Overalls'],
  },
  {
    label: 'Tongue Out or Tanuki, Kitsune or Cat Mask',
    traits: ['Tongue Out', 'Tanuki', 'Kitsune', 'Cat Mask'],
  },
  {
    label: 'Devious Mouth or Oni, Tengu or Skull Mask',
    traits: ['Devious Mouth', 'Oni', 'Tengu', 'Skull Mask'],
  },
  {
    label: 'Apron, Garbage/Gold Can or Toilet Paper',
    traits: ['Apron', 'Garbage Can', 'Gold Can', 'Toilet Paper'],
  },
  { label: 'Crying Eye', traits: ['Crying Eye'] },
  {
    label: 'Onesie or Lemon, Kappa, Tomato or Blob Head',
    traits: ['Onesie', 'Lemon', 'Kappa', 'Tomato', 'Blob Head'],
  },
  { label: 'Kimono', traits: ['Kimono'] },
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
