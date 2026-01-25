
// Service to fetch live data from Google Sheets (published as CSV)

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
    totalStats?: number; // New column
    marketLink?: string;
}

// Map key: Moki Name (normalized) -> Data
export type LiveDataMap = Record<string, MokiData>;

// Stats Sheet (Specs, WinRate, etc)
export const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?output=csv";

// Catalog Sheet (ID, Name, Rarity, ImageURL) - 720 entries
export const CATALOG_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTmjgIeuIwV9vOzPUH8UNrIjxQfB_xP2_pPCS7qqT0PRE2GUssh6qJxdoWC0M5QW6XZrF1E29F1ZMDh/pub?output=csv";

// In-memory cache to avoid redundant fetches within the same session
let cachedLiveData: LiveDataMap | null = null;
let cachedCatalogData: any[] | null = null;

export const fetchLiveData = async (): Promise<LiveDataMap | null> => {
    if (cachedLiveData) return cachedLiveData;
    const data = await fetchAndParseSheet(GOOGLE_SHEET_CSV_URL, parseStatsCSV);
    if (data) cachedLiveData = data;
    return data;
};

export const fetchCatalogData = async (): Promise<any[] | null> => {
    if (cachedCatalogData) return cachedCatalogData;
    const data = await fetchAndParseSheet(CATALOG_SHEET_CSV_URL, parseCatalogCSV);
    if (data) cachedCatalogData = data;
    return data;
};

async function fetchAndParseSheet<T>(baseUrl: string, parser: (text: string) => T): Promise<T | null> {
    if (!baseUrl) return null;
    try {
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            console.error(`Sheet Fetch Failed [${baseUrl.substring(0, 40)}...]: ${response.status}`);
            return null;
        }
        const text = await response.text();
        return parser(text);
    } catch (e) {
        console.error("Sheet Fetch Error:", e);
        return null;
    }
}

const parseStatsCSV = (csvText: string): LiveDataMap => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return {};
    const map: LiveDataMap = {};
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const getIndex = (colName: string) => headers.indexOf(colName.toLowerCase());

    const idxName = getIndex('Name');
    const idxId = getIndex('ID');
    const idxClass = getIndex('Class');
    const idxStars = getIndex('Stars');
    const idxFur = getIndex('Fur');
    const idxTraits = getIndex('Traits');
    const idxElim = getIndex('Eliminations');
    const idxDeposits = getIndex('Deposits');
    const idxWart = getIndex('WartDistance');
    const idxScore = getIndex('Score');
    const idxWinRate = getIndex('WinRate');
    let idxImg = getIndex('cardImage');
    if (idxImg === -1) idxImg = getIndex('ImageURL');
    const idxDef = getIndex('Defense');
    const idxDex = getIndex('Dexterity');
    const idxFort = getIndex('Fortitude');
    const idxSpd = getIndex('Speed');
    const idxStr = getIndex('Strength');
    let idxTotal = getIndex('Total');
    if (idxTotal === -1) idxTotal = getIndex('Total Stats');
    const idxLink = getIndex('Link');

    if (idxName === -1) return {};

    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const name = cols[idxName]?.trim();
        if (!name) continue;

        const parseNum = (val: string | undefined) => {
            if (!val) return undefined;
            const cleaned = val.replace(/,/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        map[name.toUpperCase()] = {
            name,
            id: idxId !== -1 ? cols[idxId]?.trim() : undefined,
            class: idxClass !== -1 ? cols[idxClass]?.trim() || "" : "",
            stars: idxStars !== -1 ? (parseInt(cols[idxStars]?.trim()) || 0) : 0,
            fur: idxFur !== -1 ? cols[idxFur]?.trim() || "" : "",
            traits: (idxTraits !== -1 && cols[idxTraits]) ? cols[idxTraits].split('|').map(t => t.trim()) : [],
            eliminations: parseNum(cols[idxElim]),
            deposits: parseNum(cols[idxDeposits]),
            wartDistance: parseNum(cols[idxWart]),
            score: parseNum(cols[idxScore]),
            winRate: parseNum(cols[idxWinRate]),
            imageUrl: idxImg !== -1 ? cols[idxImg]?.trim() : undefined,
            defense: parseNum(cols[idxDef]),
            dexterity: parseNum(cols[idxDex]),
            fortitude: parseNum(cols[idxFort]),
            speed: parseNum(cols[idxSpd]),
            strength: parseNum(cols[idxStr]),
            totalStats: parseNum(cols[idxTotal]),
            marketLink: idxLink !== -1 ? cols[idxLink]?.trim() : undefined
        };
    }
    return map;
};

const parseCatalogCSV = (csvText: string): any[] => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const getIndex = (n: string) => headers.indexOf(n.toLowerCase());

    const idxId = getIndex('ID');
    const idxName = getIndex('Name');
    const idxRarity = getIndex('Rarity');
    let idxImg = getIndex('cardImage');
    if (idxImg === -1) idxImg = getIndex('ImageURL');
    const idxDesc = getIndex('Description');

    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (!cols[idxName]) continue;
        data.push({
            id: idxId !== -1 ? cols[idxId]?.trim() : `item-${i}`,
            name: cols[idxName]?.trim(),
            rarity: idxRarity !== -1 ? cols[idxRarity]?.trim() : 'Basic',
            image: idxImg !== -1 ? cols[idxImg]?.trim() : '',
            description: idxDesc !== -1 ? cols[idxDesc]?.trim() : undefined
        });
    }
    return data;
};

// Helper to parse CSV line respecting quotes
function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (inQuote) {
            if (char === '"') {
                // Check if next is quote (escaped)
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
