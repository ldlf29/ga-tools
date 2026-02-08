import catalogData from '../data/catalog.json';
import mokiMetadataRaw from '../data/mokiMetadata.json';

interface MokiMetadata {
    name: string;
    portraitUrl?: string;
    fur?: string;
    traits?: string[];
    marketLink?: string;
}

const mokiMetadata = mokiMetadataRaw as Record<string, MokiMetadata>;

export interface MokiData {
    id?: string;
    name: string;
    class: string;
    stars: number;
    fur: string;
    traits: string[];
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
    totalStats?: number;
    train?: number;
    marketLink?: string;
}

export type LiveDataMap = Record<string, MokiData>;

// Stats API endpoint (Next.js route handles the 12-hour cache)
const STATS_API_URL = "/api/stats";

// In-memory cache to avoid redundant fetches within the same session
let cachedLiveData: LiveDataMap | null = null;

/**
 * Fetches dynamic stats and merges with static Moki portraits.
 * The backend manages a 12-hour cache for the stats spreadsheet.
 */
export const fetchLiveData = async (): Promise<LiveDataMap | null> => {
    if (cachedLiveData) return cachedLiveData;

    try {
        // console.log("[LiveData] Fetching cached stats from backend...");
        const response = await fetch(STATS_API_URL);
        if (!response.ok) throw new Error("Backend stats fetch failed");

        const data = await response.json();

        // Merge with our Local Source of Truth (mokiMetadata)
        const statsWithIdentity: LiveDataMap = { ...data };

        // Ensure every Moki in our identity map is present and has its correct visual data
        Object.keys(mokiMetadata).forEach((name) => {
            const identity = mokiMetadata[name];
            if (statsWithIdentity[name]) {
                // Overwrite with local identity data for consistency
                statsWithIdentity[name].imageUrl = identity.portraitUrl || statsWithIdentity[name].imageUrl;
                statsWithIdentity[name].fur = identity.fur || statsWithIdentity[name].fur || "";
                statsWithIdentity[name].traits = (identity.traits && identity.traits.length > 0) ? identity.traits : (statsWithIdentity[name].traits || []);
                statsWithIdentity[name].marketLink = identity.marketLink || statsWithIdentity[name].marketLink;
            } else {
                // If a Moki exists in our identity database but isn't in the stats sheet yet
                statsWithIdentity[name] = {
                    name: identity.name,
                    imageUrl: identity.portraitUrl || "",
                    class: '',
                    stars: 0,
                    fur: identity.fur || "",
                    traits: identity.traits || [],
                    marketLink: identity.marketLink || ""
                };
            }
        });

        cachedLiveData = statsWithIdentity;
        return statsWithIdentity;
    } catch (e) {
        console.error("[LiveData] Error fetching stats (using local metadata only):", e);
        // Fallback Mode: return at least the names and identity from our local source
        const fallbackData: LiveDataMap = {};
        Object.keys(mokiMetadata).forEach((name) => {
            const identity = mokiMetadata[name];
            fallbackData[name] = {
                name: identity.name,
                imageUrl: identity.portraitUrl || "",
                class: '',
                stars: 0,
                fur: identity.fur || "",
                traits: identity.traits || [],
                marketLink: identity.marketLink || ""
            };
        });
        return fallbackData;
    }
};

/**
 * Returns the card catalog (Identity, Rarity, Base Image).
 * Now static and fixed in the bundle for instant loading.
 */
export const fetchCatalogData = async (): Promise<unknown[] | null> => {
    return catalogData;
};

// Helper to parse CSV line respecting quotes (Used by the catalog converter)
export function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                cur += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
    }
    result.push(cur);
    return result;
}
