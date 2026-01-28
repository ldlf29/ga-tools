import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 60 seconds execution time

const STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?output=csv";

export async function GET(request: Request) {
    // Optional: Security check (Vercel Cron sends specific headers)
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return new Response('Unauthorized', { status: 401 });
    // }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Missing Supabase Credentials" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    try {
        console.log("🚀 [Cron] Starting Synchronization Job...");
        const startTime = Date.now();

        // 1. Fetch Stats from Google Sheets
        const response = await fetch(STATS_URL);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();
        const statsMap = parseStatsCSV(csvText);
        console.log(`✅ [Cron] Loaded stats for ${Object.keys(statsMap).length} champions.`);

        // 2. Load Local Data
        // Vercel Serverless: files should be traceable. 
        // We use process.cwd() + src/data structure
        const DATA_DIR = path.join(process.cwd(), 'src', 'data');
        const catalogPath = path.join(DATA_DIR, 'catalog.json');
        const imagesPath = path.join(DATA_DIR, 'mokiImages.json');

        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        const mokiImages = JSON.parse(fs.readFileSync(imagesPath, 'utf-8'));

        // 3. Merge Data
        const cardsToUpsert: any[] = [];

        for (const item of catalog) {
            const normalizedName = item.name.trim().toUpperCase();
            const stat = statsMap[normalizedName];

            const isScheme = item.id.toLowerCase().startsWith('scheme') || (item.name.includes(' ') && !stat);
            const type = isScheme ? 'SCHEME' : 'MOKI';

            let imageUrl = item.image;
            if (mokiImages[item.name]) {
                imageUrl = mokiImages[item.name];
            } else if (stat?.imageUrl) {
                imageUrl = stat.imageUrl;
            }

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

        // Deduplicate
        const uniqueCards = Array.from(new Map(cardsToUpsert.map(item => [item.id, item])).values());

        console.log(`✨ [Cron] Prepared ${uniqueCards.length} records.`);

        // 4. Batch Upsert
        const CHUNK_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < uniqueCards.length; i += CHUNK_SIZE) {
            const chunk = uniqueCards.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('cards').upsert(chunk, { onConflict: 'id' });
            if (error) throw error;
            successCount += chunk.length;
        }

        // 5. Log Success
        await supabase.from('sync_logs').insert({
            status: 'SUCCESS',
            cards_updated: successCount,
            details: `Cron: Synced ${successCount} cards in ${(Date.now() - startTime)}ms`
        });

        return NextResponse.json({ success: true, updated: successCount, duration: Date.now() - startTime });

    } catch (error: any) {
        console.error("💥 [Cron] Failed:", error);

        // Try logging failure to DB
        if (SUPABASE_URL && SERVICE_ROLE_KEY) {
            try {
                await supabase.from('sync_logs').insert({
                    status: 'ERROR',
                    cards_updated: 0,
                    details: `Cron Error: ${error.message}`
                });
            } catch (e) { /* ignore */ }
        }

        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// --- Helpers ---
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
