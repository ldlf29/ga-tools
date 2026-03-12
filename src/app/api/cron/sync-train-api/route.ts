import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

import { waitUntil } from '@vercel/functions';

// Configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes execution time (Fluid Compute / Pro)

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const API_BASE_URL = "https://train.grandarena.gg/api/moki/";

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
    // 1. Verify Authentication
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Cron Train] Train API sync triggered... starting in background.`);
    
    const allTokenIds = Object.values(mokiMetadata)
        .map(m => m.id)
        .filter(id => !!id);

    // Run the long process in the background using Vercel's waitUntil
    waitUntil((async () => {
        try {
            const startTime = Date.now();
            const results: any[] = [];
            
            const CONCURRENCY_LIMIT = 4; // Fetch 4 Mokis at a time
            const DELAY_BETWEEN_BATCHES = 4000; // Wait 4 seconds -> 1 batch every 4 seconds = 15 batches/min = 60 requests/min

            // 2. Paced Parallel Fetching (Fluid Compute approach)
            for (let i = 0; i < allTokenIds.length; i += CONCURRENCY_LIMIT) {
                const chunkIds = allTokenIds.slice(i, i + CONCURRENCY_LIMIT);
                console.log(`[Cron Train] Processing Mokis ${i} to ${i + chunkIds.length}...`);
                
                const fetchPromises = chunkIds.map(async (tokenId) => {
                    try {
                        const response = await fetch(`${API_BASE_URL}${tokenId}`, {
                            headers: { 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(10000)
                        });

                        if (response.status === 429) {
                            console.error(`[Cron Train] RATE LIMIT 429 for tokenId ${tokenId}!`);
                            return null;
                        }

                        if (!response.ok) {
                            console.error(`[Cron Train] API Error for tokenId ${tokenId}: ${response.status}`);
                            return null;
                        }

                        const data = await response.json();
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

                // Apply delay to respect RATE LIMIT
                if (i + CONCURRENCY_LIMIT < allTokenIds.length) {
                    await delay(DELAY_BETWEEN_BATCHES);
                }
            }

            console.log(`[Cron Train] Fetched ${results.length} records. Syncing to DB...`);

            // 3. Merge with existing DB data
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

            // 4. Batch Upsert to Supabase
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

            const duration = Date.now() - startTime;
            
            await supabaseAdmin.from('sync_logs').insert({
                status: 'success',
                cards_updated: successCount,
                details: `Cron Train API (Background): Synced ${successCount} Mokis & ${matchesCount} Matches in ${duration}ms`
            });
            console.log(`[Cron Train] Background Sync Complete. Updated ${successCount} Mokis.`);

        } catch (e: any) {
            console.error('[Cron Train] Fatal Error in background sync:', e);
            
            await supabaseAdmin.from('sync_logs').insert({
                status: 'error',
                cards_updated: 0,
                details: `Cron Train API Error: ${e.message || 'Unknown error'}`
            });
        }
    })());

    // 5. Respond immediately to cron-job.org to prevent Timeout
    return NextResponse.json({ 
        success: true, 
        message: "Train API sync started in background.",
        note: "Data will be updated asynchronously."
    });
}
