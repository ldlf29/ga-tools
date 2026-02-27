import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseCSVLine } from '@/utils/csv';

// Force dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?output=csv";

interface MokiStats {
    name: string;
    stars: number;
    eliminations: number;
    deposits: number;
    wart_distance: number;
    score: number;
    win_rate: number;
}

export async function GET(request: Request) {
    const CRON_SECRET = process.env.CRON_SECRET;

    // 🔒 Security Check
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    try {
        console.log("🚀 [Cron] Starting Synchronization Job...");
        const startTime = Date.now();

        // 1. Fetch Stats from Google Sheets
        const response = await fetch(STATS_URL);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();
        const statsRecords = parseStatsCSV(csvText);
        console.log(`✅ [Cron] Loaded stats for ${statsRecords.length} Mokis.`);

        // 2. detecting Class Changes is now handled by the 10-minute Game API sync.
        // We skip it here to keep the Google Sheet sync focused on performance stats.

        // 3. Merge with existing DB data to prevent overwriting Base Stats/Training
        const { data: dbStats } = await supabaseAdmin
            .from('moki_stats')
            .select('*');

        const dbMap = new Map<string, any>();
        if (dbStats) {
            dbStats.forEach(row => dbMap.set(row.name.trim().toUpperCase(), row));
        }

        const mergedUpdates = statsRecords.map(record => {
            const upperName = record.name.trim().toUpperCase();
            const existing = dbMap.get(upperName) || {};

            return {
                ...existing,
                ...record,
                last_updated: new Date().toISOString()
            };
        });

        // 4. Batch Upsert to moki_stats
        const CHUNK_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < mergedUpdates.length; i += CHUNK_SIZE) {
            const chunk = mergedUpdates.slice(i, i + CHUNK_SIZE);
            const { error } = await supabaseAdmin.from('moki_stats').upsert(chunk, { onConflict: 'name' });
            if (error) throw error;
            successCount += chunk.length;
        }

        // 4. Log Success
        await supabaseAdmin.from('sync_logs').insert({
            status: 'SUCCESS',
            cards_updated: successCount,
            details: `Cron: Synced ${successCount} Moki stats in ${(Date.now() - startTime)}ms`
        });

        return NextResponse.json({ success: true, updated: successCount, duration: Date.now() - startTime });

    } catch (error) {
        console.error("💥 [Cron] Failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        try {
            await supabaseAdmin.from('sync_logs').insert({
                status: 'ERROR',
                cards_updated: 0,
                details: `Cron Error: ${errorMessage}`
            });
        } catch (e) { /* ignore */ }

        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

// --- Helpers ---

function parseStatsCSV(csvText: string): MokiStats[] {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const statsRecords: MokiStats[] = [];
    const seenNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || ''; });

        const name = row['name'] || '';
        if (!name || seenNames.has(name.toUpperCase())) continue;
        seenNames.add(name.toUpperCase());

        // Helper to clean commas from numbers (e.g., "1,234" -> 1234)
        const parseNum = (val: string | undefined): number => {
            if (!val) return 0;
            const cleaned = val.toString().replace(/,/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };

        statsRecords.push({
            name: name,
            stars: parseInt((row['stars'] || '0').replace(/,/g, ''), 10) || 0,
            eliminations: parseNum(row['eliminations']),
            deposits: parseNum(row['deposits']),
            wart_distance: parseNum(row['wart distance'] || row['wartdistance']),
            score: parseNum(row['score']),
            win_rate: parseNum(row['win rate'] || row['winrate'])
        });
    }

    return statsRecords;
}
