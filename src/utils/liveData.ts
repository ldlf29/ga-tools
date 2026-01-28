import catalogData from '../data/catalog.json';
import mokiImages from '../data/mokiImages.json';

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
        console.log("[LiveData] Fetching cached stats from backend...");
        const response = await fetch(STATS_API_URL);
        if (!response.ok) throw new Error("Backend stats fetch failed");

        const data = await response.json();

        // Merge with static mokiImages (Our Source of Truth for portraits)
        const statsWithImages: LiveDataMap = { ...data };

        // Ensure every Moki in our static image map is present and has its photo
        Object.entries(mokiImages).forEach(([name, imgUrl]) => {
            if (statsWithImages[name]) {
                statsWithImages[name].imageUrl = imgUrl;
            } else {
                // If a Moki exists in our image database but isn't in the stats sheet yet
                statsWithImages[name] = {
                    name,
                    imageUrl: imgUrl,
                    class: '',
                    stars: 0,
                    fur: '',
                    traits: []
                };
            }
        });

        cachedLiveData = statsWithImages;
        return statsWithImages;
    } catch (e) {
        console.error("[LiveData] Error fetching stats:", e);
        // Fallback Mode: return at least the names and images so the UI doesn't break
        const fallbackData: LiveDataMap = {};
        Object.entries(mokiImages).forEach(([name, imgUrl]) => {
            fallbackData[name] = { name, imageUrl: imgUrl, class: '', stars: 0, fur: '', traits: [] };
        });
        return fallbackData;
    }
};

/**
 * Returns the card catalog (Identity, Rarity, Base Image).
 * Now static and fixed in the bundle for instant loading.
 */
export const fetchCatalogData = async (): Promise<any[] | null> => {
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
