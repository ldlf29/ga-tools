import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import mokiMetadataRaw from '../data/mokiMetadata.json';

// Carga de variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const API_BASE_URL = "https://train.grandarena.gg/api/moki/";

const CONCURRENCY_LIMIT = 4; 
const DELAY_BETWEEN_BATCHES = 4000; 

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
    console.log('[Cron Train] Starting Train API sync...');
    const startTime = Date.now();

    const allTokenIds = Object.values(mokiMetadata)
        .map(m => m.id)
        .filter(id => !!id);

    console.log(`[Cron Train] Fetching for ${allTokenIds.length} Mokis...`);
    const results: any[] = [];

    for (let i = 0; i < allTokenIds.length; i += CONCURRENCY_LIMIT) {
        const chunkIds = allTokenIds.slice(i, i + CONCURRENCY_LIMIT);
        console.log(`[Cron Train] Processing Mokis ${i} to ${i + chunkIds.length}...`);

        const fetchPromises = chunkIds.map(async (tokenId) => {
            try {
                const response = await fetch(`${API_BASE_URL}${tokenId}`, {
                    headers: { 'Accept': 'application/json' }
                });

                if (response.status === 429) {
                    console.error(`[Cron Train] RATE LIMIT 429 for tokenId ${tokenId}!`);
                    return null;
                }

                if (!response.ok) {
                    console.error(`[Cron Train] API Error for tokenId ${tokenId}: ${response.status}`);
                    return null;
                }

                const data = await response.json() as any;
                if (!data) return null;

                const stats = (data.performance && data.performance.stats) ? data.performance.stats : {};
                
                return {
                    mokiStats: {
                        name: data.name,
                        eliminations: stats.avgKills || 0,
                        deposits: stats.avgBalls || 0,
                        wart_distance: stats.avgWortDistance || 0,
                        score: stats.avgScore || 0,
                        win_rate: stats.winPct || 0
                    },
                    schedule: data.matches?.scheduled || []
                };
            } catch (err) {
                console.error(`[Cron Train] Failed to fetch tokenId ${tokenId}:`, err);
                return null;
            }
        });

        const batchResults = await Promise.all(fetchPromises);
        results.push(...batchResults.filter(r => r !== null));

        if (i + CONCURRENCY_LIMIT < allTokenIds.length) {
            await delay(DELAY_BETWEEN_BATCHES);
        }
    }

    console.log(`[Cron Train] Fetched ${results.length} records. Syncing to DB...`);

    // 1. Merge with existing DB data
    const { data: dbStats } = await supabaseAdmin.from('moki_stats').select('*');
    const dbMap = new Map<string, any>();
    if (dbStats) {
        dbStats.forEach(row => dbMap.set(row.name.trim().toUpperCase(), row));
    }

    const statsUpdates: any[] = [];
    const upcomingMatchesInserts: any[] = [];

    results.forEach(record => {
        const mokiName = record.mokiStats.name.trim();
        const upperName = mokiName.toUpperCase();
        const existing = dbMap.get(upperName) || {};
        
        statsUpdates.push({
            ...existing,
            ...record.mokiStats,
            last_updated: new Date().toISOString()
        });

        if (record.schedule && Array.isArray(record.schedule)) {
            for (const match of record.schedule) {
                if (!match || !match.id) continue;
                
                upcomingMatchesInserts.push({
                    id: match.id,
                    title: match.title || '',
                    subtitle: match.subtitle || '',
                    team1_name: match.team1?.name || '',
                    team2_name: match.team2?.name || '',
                    team1_mokis: match.team1?.mokis || [],
                    team2_mokis: match.team2?.mokis || [],
                    user_mokis: match.userMokis || [],
                    target_moki_name: mokiName
                });
            }
        }
    });

    // 2. Batch Upsert to Supabase
    const DB_CHUNK_SIZE = 50;
    let successCount = 0;

    for (let i = 0; i < statsUpdates.length; i += DB_CHUNK_SIZE) {
        const chunk = statsUpdates.slice(i, i + DB_CHUNK_SIZE);
        const { error } = await supabaseAdmin
            .from('moki_stats')
            .upsert(chunk, { onConflict: 'name' });
        
        if (error) throw error;
        successCount += chunk.length;
    }

    let matchesCount = 0;
    if (upcomingMatchesInserts.length > 0) {
        const uniqueMatchesMap = new Map();
        upcomingMatchesInserts.forEach(m => uniqueMatchesMap.set(m.id, m));
        const uniqueMatchesInfo = Array.from(uniqueMatchesMap.values());

        for (let i = 0; i < uniqueMatchesInfo.length; i += DB_CHUNK_SIZE) {
            const chunk = uniqueMatchesInfo.slice(i, i + DB_CHUNK_SIZE);
            const { error } = await supabaseAdmin
                .from('upcoming_matches')
                .upsert(chunk, { onConflict: 'id' });
            
            if (error) {
                console.error('[Cron Train] Warning: Error upserting upcoming matches:', error);
            } else {
                matchesCount += chunk.length;
            }
        }
    }

    console.log(`[Cron Train] Sync Complete. Updated ${successCount} Mokis & ${matchesCount} Matches.`);

    await supabaseAdmin.from('sync_logs').insert({
        status: 'success',
        cards_updated: successCount,
        details: `GitHub Action Train API: Synced ${successCount} Mokis & ${matchesCount} Matches.`
    });
}

run().catch(e => {
    console.error("Fatal Error:", e);
    process.exit(1);
});
