import catalogData from '../data/catalog.json';
import mokiMetadataRaw from '../data/mokiMetadata.json';

interface MokiMetadata {
  id?: string;
  name: string;
  portraitUrl?: string;
  fur?: string;
  traits?: string[];
  schemes?: string[];
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
  traitSchemes?: string[];
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

      // Ensure every Moki in our identity map is present and has its correct visual data.
      // Keys in mokiMetadata may use underscores (e.g. "GOLDEN_BONES") while the stats
      // API uses spaces (e.g. "GOLDEN BONES"). Normalize to spaces for consistent lookup.
      Object.keys(mokiMetadata).forEach((key) => {
        const identity = mokiMetadata[key];
        // Normalize: underscore → space, so "GOLDEN_BONES" becomes "GOLDEN BONES"
        const normalizedKey = key.replace(/_/g, ' ');

        if (statsWithIdentity[normalizedKey]) {
          // Overwrite with local identity data for consistency
          statsWithIdentity[normalizedKey].imageUrl =
            identity.portraitUrl || statsWithIdentity[normalizedKey].imageUrl;
          statsWithIdentity[normalizedKey].fur =
            identity.fur || statsWithIdentity[normalizedKey].fur || '';
          statsWithIdentity[normalizedKey].traits =
            identity.traits && identity.traits.length > 0
              ? identity.traits
              : statsWithIdentity[normalizedKey].traits || [];
          statsWithIdentity[normalizedKey].marketLink =
            identity.marketLink || statsWithIdentity[normalizedKey].marketLink;
          statsWithIdentity[normalizedKey].traitSchemes =
            identity.schemes && identity.schemes.length > 0
              ? identity.schemes
              : statsWithIdentity[normalizedKey].traitSchemes || [];
          statsWithIdentity[normalizedKey].tokenId = identity.id
            ? parseInt(identity.id, 10)
            : undefined;
        } else {
          // Moki exists in identity database but not in stats yet — create stub entry
          statsWithIdentity[normalizedKey] = {
            name: identity.name,
            imageUrl: identity.portraitUrl || '',
            class: '',
            stars: 0,
            fur: identity.fur || '',
            traits: identity.traits || [],
            traitSchemes: identity.schemes || [],
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
      Object.keys(mokiMetadata).forEach((key) => {
        const identity = mokiMetadata[key];
        // Same normalization: underscore → space
        const normalizedKey = key.replace(/_/g, ' ');
        fallbackData[normalizedKey] = {
          name: identity.name,
          imageUrl: identity.portraitUrl || '',
          class: '',
          stars: 0,
          fur: identity.fur || '',
          traits: identity.traits || [],
          traitSchemes: identity.schemes || [],
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
