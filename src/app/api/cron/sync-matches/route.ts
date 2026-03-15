import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

import { waitUntil } from '@vercel/functions';

// Configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Fluid Compute limit

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const CONCURRENCY_LIMIT = 20; // Parallel fetch chunk size
const DELAY_BETWEEN_BATCHES = 2000; // 2s pacing between chunks

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
    // 1. Verify Authentication
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    const GA_API_KEY = process.env.GA_API_KEY;

    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GA_API_KEY) {
        return NextResponse.json({ error: 'GA_API_KEY not configured' }, { status: 500 });
    }

    console.log('[Cron Matches] Starting Full Match Sync in background...');
    
    // 2. Identify all Token IDs
    const allTokenIds = Object.values(mokiMetadata)
        .map(m => m.id)
        .filter(id => !!id);

    // Run the heavy logic in the background using Vercel's waitUntil
    waitUntil((async () => {
        try {
            const startTime = Date.now();

            console.log(`[Cron Matches] Fetching matches for ${allTokenIds.length} Mokis...`);

            // 3. Controlled Parallel Fetching
            const matchHistoryRecords: any[] = [];

            for (let i = 0; i < allTokenIds.length; i += CONCURRENCY_LIMIT) {
                const chunkTokenIds = allTokenIds.slice(i, i + CONCURRENCY_LIMIT);
                console.log(`[Cron Matches] Fetching Chunk ${i / CONCURRENCY_LIMIT + 1}...`);

                const fetchPromises = chunkTokenIds.map(async (tokenId) => {
                    const apiUrl = `https://api.grandarena.gg/api/v1/mokis/${tokenId}/performances?page=1&limit=30`;
                    try {
                        const response = await fetch(apiUrl, {
                            headers: {
                                'Accept': 'application/json',
                                'Authorization': `Bearer ${GA_API_KEY}`
                            },
                            signal: AbortSignal.timeout(15000)
                        });

                        if (!response.ok) {
                            console.error(`[Cron Matches] API Error for tokenId ${tokenId}: ${response.status}`);
                            return [];
                        }

                        const json = await response.json();
                        const performances = json.data;
                        const records: any[] = [];

                        if (performances && Array.isArray(performances)) {
                            for (const perf of performances) {
                                const match = perf.match;
                                if (!match || !match.result) continue;

                                const targetMokiHash = perf.mokiId;
                                const playerInfo = match.players?.find((p: any) => p.mokiId === targetMokiHash);
                                const perfResults = perf.results || {};
                                
                                const isWinner = (playerInfo && match.result.teamWon !== undefined)
                                    ? playerInfo.team === match.result.teamWon
                                    : false;

                                records.push({
                                    match_id: match.id,
                                    moki_id: targetMokiHash,
                                    token_id: parseInt(tokenId, 10),
                                    moki_name: playerInfo?.name || 'Unknown',
                                    moki_class: playerInfo?.class || '',
                                    moki_image_url: playerInfo?.imageUrl || '',
                                    moki_team: playerInfo?.team || 0,
                                    eliminations: perfResults.eliminations || 0,
                                    deposits: perfResults.deposits || 0,
                                    wart_distance: perfResults.wartDistance || 0,
                                    win_type: (match.result.winType === 'Eliminations') ? 'Combat' : (match.result.winType || 'unknown'),
                                    team_won: match.result.teamWon || 0,
                                    is_winner: isWinner,
                                    duration: match.result.duration || 0,
                                    match_date: perf.matchDate || match.matchDate || new Date().toISOString().split('T')[0],
                                    match_data: match
                                });
                            }
                        }
                        return records;
                    } catch (err) {
                        console.error(`[Cron Matches] Failed tokenId ${tokenId}:`, err);
                        return [];
                    }
                });

                const resultsArray = await Promise.all(fetchPromises);
                matchHistoryRecords.push(...resultsArray.flat());

                // Respect the pacing requested
                if (i + CONCURRENCY_LIMIT < allTokenIds.length) {
                    await delay(DELAY_BETWEEN_BATCHES);
                }
            }

            // 4. Batch Upsert to Supabase
            let recordsUpserted = 0;
            if (matchHistoryRecords.length > 0) {
                console.log(`[Cron Matches] Upserting ${matchHistoryRecords.length} match records to DB...`);

                const DB_CHUNK_SIZE = 100;
                for (let i = 0; i < matchHistoryRecords.length; i += DB_CHUNK_SIZE) {
                    const chunk = matchHistoryRecords.slice(i, i + DB_CHUNK_SIZE);
                    const { error: upsertErr } = await supabaseAdmin
                        .from('moki_match_history')
                        .upsert(chunk, { onConflict: 'moki_id, match_id' });

                    if (upsertErr) throw upsertErr;
                    recordsUpserted += chunk.length;
                }
            }

            // 5. Save Status Log
            await supabaseAdmin.from('sync_logs').insert({
                status: 'success',
                cards_updated: recordsUpserted,
                details: `Cron Matches API (Background): Processed ${allTokenIds.length} mokis. Upserted ${recordsUpserted}. Duration: ${Date.now() - startTime}ms`
            });

            // 6. Housekeeping: Keep only the latest 40 matches per Moki ID
            let recordsDeleted = 0;
            try {
                const { data: deletedData, error: cleanupErr } = await supabaseAdmin
                    .rpc('cleanup_old_matches', { keep_count: 40 });

                if (cleanupErr) {
                    console.error(`[Cron Matches] Housekeeping SQL error:`, cleanupErr);
                } else {
                    recordsDeleted = deletedData ?? 0;
                    if (recordsDeleted > 0) {
                        console.log(`[Cron Matches] Housekeeping: deleted ${recordsDeleted} old matches.`);
                    }
                }
            } catch (err) {
                console.error(`[Cron Matches] Housekeeping failed:`, err);
            }
            
            // 7. Update Daily Leaderboard
            try {
                const { error: rpcErr } = await supabaseAdmin.rpc('update_daily_leaderboard');
                if (rpcErr) {
                    console.error('[Cron Matches] Leaderboard RPC error:', rpcErr);
                } else {
                    console.log('[Cron Matches] Daily leaderboard updated successfully.');
                }
            } catch (err) {
                console.error('[Cron Matches] Leaderboard RPC failed:', err);
            }

            console.log(`[Cron Matches] Background Sync Complete. Upserted ${recordsUpserted}.`);

        } catch (error: any) {
            console.error('[Cron Matches] Fatal Error in background sync:', error);
            
            await supabaseAdmin.from('sync_logs').insert({
                status: 'error',
                cards_updated: 0,
                details: `Cron Matches Error: ${error.message || 'Unknown error'}`
            });
        }
    })());

    // 7. Respond immediately to cron-job.org to prevent Timeout
    return NextResponse.json({ 
        success: true, 
        message: "Matches API sync started in background.",
        note: "Data will be updated asynchronously."
    });
}
