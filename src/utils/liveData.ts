
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

// Placeholder URL - User needs to replace this
// We use a constant that can be easily found and replaced
export const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?gid=0&single=true&output=csv";

export const fetchLiveData = async (): Promise<LiveDataMap | null> => {
    if (!GOOGLE_SHEET_CSV_URL || GOOGLE_SHEET_CSV_URL.includes("PasteYour")) {
        console.warn("Live Data: No valid Google Sheet URL provided.");
        return null;
    }

    try {
        // Add timestamp to prevent caching - CRITICAL for Google Sheets CSV
        const url = `${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to fetch CSV: ${response.status}`);
        }
        const text = await response.text();
        return parseCSV(text);
    } catch (e) {
        console.error("Live Data Fetch Error:", e);
        return null;
    }
};

const parseCSV = (csvText: string): LiveDataMap => {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return {}; // Need header + at least 1 row

    const map: LiveDataMap = {};

    // 1. Parse Headers dynamically
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

    const getIndex = (colName: string) => headers.indexOf(colName.toLowerCase());

    const idxName = getIndex('Name');
    const idxId = getIndex('ID'); // Optional but good to have
    const idxClass = getIndex('Class');
    const idxStars = getIndex('Stars');
    const idxFur = getIndex('Fur');
    const idxTraits = getIndex('Traits');

    // New Stats (Round 1)
    const idxElim = getIndex('Eliminations');
    const idxDeposits = getIndex('Deposits');
    const idxWart = getIndex('WartDistance');
    const idxScore = getIndex('Score');
    const idxWinRate = getIndex('WinRate');

    // New Stats (Round 2)
    const idxImg = getIndex('ImageURL');
    const idxDef = getIndex('Defense');
    const idxDex = getIndex('Dexterity');
    const idxFort = getIndex('Fortitude');
    const idxSpd = getIndex('Speed');
    const idxStr = getIndex('Strength');

    // Robust Total check: look for "Total" OR "Total Stats"
    let idxTotal = getIndex('Total');
    if (idxTotal === -1) idxTotal = getIndex('Total Stats');

    const idxLink = getIndex('Link');

    // Name is mandatory for our key map
    if (idxName === -1) {
        console.error("Live Data: 'Name' column not found in CSV.");
        return {};
    }

    // 2. Parse Rows
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // Robust CSV Line Parser that handles quotes
        const cols = parseCSVLine(line);

        const name = cols[idxName]?.trim();
        if (!name) continue;

        const traitsRaw = idxTraits !== -1 ? cols[idxTraits]?.trim() : "";
        const traits = traitsRaw ? traitsRaw.split('|').map(t => t.trim()) : [];

        // Helper to safely parse number users might input "1,000" or "10"
        const parseNum = (val: string | undefined) => {
            if (!val) return undefined;
            const cleaned = val.replace(/,/g, '').trim(); // Remove commas if any
            const num = parseFloat(cleaned);
            return isNaN(num) ? undefined : num;
        };

        map[name.toUpperCase()] = {
            name,
            id: idxId !== -1 ? cols[idxId]?.trim() : undefined,
            class: idxClass !== -1 ? cols[idxClass]?.trim() || "" : "",
            stars: idxStars !== -1 ? (parseInt(cols[idxStars]?.trim()) || 0) : 0,
            fur: idxFur !== -1 ? cols[idxFur]?.trim() || "" : "",
            traits,
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
