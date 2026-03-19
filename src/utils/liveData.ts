import catalogData from '../data/catalog.json';
import mokiMetadataRaw from '../data/mokiMetadata.json';

interface MokiMetadata {
  id?: string;
  name: string;
  portraitUrl?: string;
  fur?: string;
  traits?: string[];
  marketLink?: string;
}

const mokiMetadata = mokiMetadataRaw as Record<string, MokiMetadata>;

export interface MokiData {
  id?: string;
  tokenId?: number;
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
  // Last 10 Averages
  avgEliminations10?: number;
  avgDeposits10?: number;
  avgWartDistance10?: number;
  avgScore10?: number;
  avgWinRate10?: number;

  // Last 20 Averages
  avgEliminations20?: number;
  avgDeposits20?: number;
  avgWartDistance20?: number;
  avgScore20?: number;
  avgWinRate20?: number;

  // Last 30 Averages
  avgEliminations30?: number;
  avgDeposits30?: number;
  avgWartDistance30?: number;
  avgScore30?: number;
  avgWinRate30?: number;

  // Backwards compatibility
  avgEliminations?: number;
  avgDeposits?: number;
  avgWartDistance?: number;
  avgScore?: number;
  avgWinRate?: number;
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
const STATS_API_URL = '/api/stats';

// In-memory cache to avoid redundant fetches within the same session
let cachedLiveData: LiveDataMap | null = null;
let fetchPromise: Promise<LiveDataMap | null> | null = null;

/**
 * Fetches dynamic stats and merges with static Moki portraits.
 * The backend manages a 12-hour cache for the stats spreadsheet.
 */
export const fetchLiveData = async (): Promise<LiveDataMap | null> => {
  if (cachedLiveData) return cachedLiveData;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      // console.log("[LiveData] Fetching cached stats from backend...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(STATS_API_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(`Backend stats fetch failed: ${response.status}`);

      const data = await response.json();
      console.log(
        `[LiveData] Successfully loaded stats for ${Object.keys(data).length} objects`
      );

      // Merge with our Local Source of Truth (mokiMetadata)
      const statsWithIdentity: LiveDataMap = { ...data };

      // Ensure every Moki in our identity map is present and has its correct visual data
      Object.keys(mokiMetadata).forEach((name) => {
        const identity = mokiMetadata[name];
        if (statsWithIdentity[name]) {
          // Overwrite with local identity data for consistency
          statsWithIdentity[name].imageUrl =
            identity.portraitUrl || statsWithIdentity[name].imageUrl;
          statsWithIdentity[name].fur =
            identity.fur || statsWithIdentity[name].fur || '';
          statsWithIdentity[name].traits =
            identity.traits && identity.traits.length > 0
              ? identity.traits
              : statsWithIdentity[name].traits || [];
          statsWithIdentity[name].marketLink =
            identity.marketLink || statsWithIdentity[name].marketLink;
          statsWithIdentity[name].tokenId = identity.id
            ? parseInt(identity.id, 10)
            : undefined;
        } else {
          // If a Moki exists in our identity database but isn't in the stats sheet yet
          statsWithIdentity[name] = {
            name: identity.name,
            imageUrl: identity.portraitUrl || '',
            class: '',
            stars: 0,
            fur: identity.fur || '',
            traits: identity.traits || [],
            marketLink: identity.marketLink || '',
            tokenId: identity.id ? parseInt(identity.id, 10) : undefined,
          };
        }
      });

      cachedLiveData = statsWithIdentity;
      return statsWithIdentity;
    } catch (e) {
      console.error(
        '[LiveData] Error fetching stats (using local metadata only):',
        e
      );
      // Fallback Mode: return at least the names and identity from our local source
      const fallbackData: LiveDataMap = {};
      Object.keys(mokiMetadata).forEach((name) => {
        const identity = mokiMetadata[name];
        fallbackData[name] = {
          name: identity.name,
          imageUrl: identity.portraitUrl || '',
          class: '',
          stars: 0,
          fur: identity.fur || '',
          traits: identity.traits || [],
          marketLink: identity.marketLink || '',
          tokenId: identity.id ? parseInt(identity.id, 10) : undefined,
        };
      });
      return fallbackData;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
};

/**
 * Returns the card catalog (Identity, Rarity, Base Image).
 * Now static and fixed in the bundle for instant loading.
 */
export const fetchCatalogData = async (): Promise<unknown[] | null> => {
  return catalogData;
};
// Re-export parseCSVLine from shared utility
export { parseCSVLine } from '@/utils/csv';
