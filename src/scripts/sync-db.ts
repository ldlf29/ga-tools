
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fetch } from 'undici'; // Or use global fetch if Node 18+

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase Credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?output=csv";

// Paths
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const CATALOG_PATH = path.join(DATA_DIR, 'catalog.json');
const IMAGES_PATH = path.join(DATA_DIR, 'mokiImages.json');

async function main() {
    console.log("🚀 Starting Synchronization Job...");
    const startTime = Date.now();

    try {
        // 1. Fetch Google Sheets CSV
        console.log("📥 Fetching Stats from Google Sheets...");
        const response = await fetch(STATS_URL);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();
        const statsMap = parseStatsCSV(csvText);
        console.log(`✅ Loaded stats for ${Object.keys(statsMap).length} champions.`);

        // 2. Load Local Data
        console.log("📂 Loading Local Catalogs...");
        const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
        const mokiImages = JSON.parse(fs.readFileSync(IMAGES_PATH, 'utf-8'));

        // 3. Merge Data
        console.log("🔄 Merging Data...");
        const cardsToUpsert = [];

        for (const item of catalog) {
            const normalizedName = item.name.trim().toUpperCase();
            const stat = statsMap[normalizedName];

            // Determine Type
            // Reuse logic: Scheme if starts with 'Scheme' or in Scheme list basically
            // Simplified: If it has stats, it's MOKI (mostly), else check heuristics
            // But we have strict types in DB.
            const isScheme = item.id.toLowerCase().startsWith('scheme') || (item.name.includes(' ') && !stat);
            const type = isScheme ? 'SCHEME' : 'MOKI';

            // Image Prioritization
            // 1. MokiImages (Local Optimized) -> 2. Stats URL -> 3. Catalog URL
            let imageUrl = item.image;
            if (mokiImages[item.name]) {
                imageUrl = mokiImages[item.name];
            } else if (stat?.imageUrl) {
                imageUrl = stat.imageUrl;
            }

            // Construct DB Record
            // IMPORTANT: Moki IDs in catalog are shared across rarities (e.g. "2" is shared by Basic, Rare, Epic, Legendary).
            // We must create a composite ID.
            let uniqueId = item.id;
            if (type === 'MOKI') {
                uniqueId = `${item.id}_${item.rarity.toUpperCase()}`;
            }
            if (!uniqueId) {
                uniqueId = `generated_${normalizedName.replace(/\s+/g, '_')}_${item.rarity?.toUpperCase() || 'COMMON'}`;
            }

            const record = {
                id: uniqueId,
                name: item.name,
                rarity: item.rarity || 'Basic',
                type: type,
                image_url: imageUrl,
                market_link: stat?.marketLink || item.external_url || '',
                stats: stat || {}, // Store raw stats object
                last_updated: new Date().toISOString()
            };

            cardsToUpsert.push(record);
        }

        // Deduplicate cards by ID to prevent "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueCards = Array.from(new Map(cardsToUpsert.map(item => [item.id, item])).values());

        console.log(`✨ Prepared ${uniqueCards.length} records for DB (filtered from ${cardsToUpsert.length}).`);

        // 4. Batch Upsert to Supabase
        // Supabase limits batch sizes, safer to do chunks of 100
        const CHUNK_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < uniqueCards.length; i += CHUNK_SIZE) {
            const chunk = uniqueCards.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('cards').upsert(chunk, { onConflict: 'id' });

            if (error) {
                console.error(`❌ Error upserting chunk ${i}-${i + CHUNK_SIZE}:`, error);
                throw error;
            }
            successCount += chunk.length;
            process.stdout.write(`.`);
        }
        console.log("\n");

        // 5. Log Success
        await supabase.from('sync_logs').insert({
            status: 'SUCCESS',
            cards_updated: successCount,
            details: `Synced ${successCount} cards in ${(Date.now() - startTime)}ms`
        });

        console.log(`🎉 Sync Complete! Updated ${successCount} cards.`);
        process.exit(0);

    } catch (error: any) {
        console.error("\n💥 Sync Failed:", error);

        // Log Error
        try {
            await supabase.from('sync_logs').insert({
                status: 'ERROR',
                cards_updated: 0,
                details: error.message
            });
        } catch (logError) {
            console.error("Failed to log error to DB:", logError);
        }

        process.exit(1);
    }
}

// --- Helpers ---

// Simplified CSV Parser (Copied from liveData/route logic for standalone usage)
function parseCSVLine(text: string): string[] {
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

function parseStatsCSV(csvText: string): Record<string, any> {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return {};

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

    // Fuzzy finder helper
    const findIndex = (searchTerms: string[]) => {
        for (const term of searchTerms) {
            const idx = headers.indexOf(term.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const idxName = findIndex(['Name']);
    const idxClass = findIndex(['Class']);
    const idxStars = findIndex(['Stars']);
    const idxFur = findIndex(['Fur']);
    const idxTraits = findIndex(['Traits']);
    const idxElim = findIndex(['Eliminations', 'Elims', 'E']);
    const idxDeposits = findIndex(['Deposits', 'Balls', 'D']);
    const idxWart = findIndex(['Wart Distance', 'WartDistance', 'Wart']);
    const idxScore = findIndex(['Score', 'S']);
    const idxWinRate = findIndex(['Win Rate', 'Winrate', 'W/R']);
    const idxDef = findIndex(['Defense', 'Def']);
    const idxDex = findIndex(['Dexterity', 'Dex']);
    const idxFort = findIndex(['Fortitude', 'Fort', 'For']);
    const idxSpd = findIndex(['Speed', 'Spd']);
    const idxStr = findIndex(['Strength', 'Str']);
    const idxTotal = findIndex(['Total Stats', 'TotalStats', 'Total']);
    const idxLink = findIndex(['Link', 'Market Link']);

    if (idxName === -1) return {};

    const map: Record<string, any> = {};
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
            class: idxClass !== -1 ? cols[idxClass]?.trim() || "" : "",
            stars: idxStars !== -1 ? (parseInt(cols[idxStars]?.trim()) || 0) : 0,
            fur: idxFur !== -1 ? cols[idxFur]?.trim() || "" : "",
            traits: (idxTraits !== -1 && cols[idxTraits]) ? cols[idxTraits].split('|').map(t => t.trim()) : [],
            eliminations: parseNum(cols[idxElim]),
            deposits: parseNum(cols[idxDeposits]),
            wartDistance: parseNum(cols[idxWart]),
            score: parseNum(cols[idxScore]),
            winRate: parseNum(cols[idxWinRate]),
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
}

main(); // Run
