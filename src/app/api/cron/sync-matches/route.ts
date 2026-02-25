import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const BATCH_SIZE = 180; // Process all 180 Mokis in a single run

export async function GET(request: NextRequest) {
    // 1. Verify Authentication
    const urlSecret = request.nextUrl.searchParams.get('secret');
    const CRON_SECRET = process.env.CRON_SECRET;
    const GA_API_KEY = process.env.GA_API_KEY;

    if (!CRON_SECRET || urlSecret !== CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GA_API_KEY) {
        return NextResponse.json({ error: 'GA_API_KEY not configured' }, { status: 500 });
    }

    try {
        console.log('[Cron Matches] Starting Controlled Parallel Sync...');

        // 2. Identify Batch
        const { data: syncState } = await supabaseAdmin
            .from('sync_logs')
            .select('details')
            .eq('status', 'matches_cursor')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let startIndex = syncState ? parseInt(syncState.details, 10) : 0;

        const allTokenIds = Object.values(mokiMetadata)
            .map(m => m.id)
            .filter(id => !!id);

        if (startIndex >= allTokenIds.length) startIndex = 0;

        const batchTokenIds = allTokenIds.slice(startIndex, startIndex + BATCH_SIZE);
        console.log(`[Cron Matches] Batch: ${startIndex} to ${startIndex + batchTokenIds.length}`);

        // 3. Controlled Parallel Fetching in chunks
        const CONCURRENCY_LIMIT = 20; // Process 20 at a time, so we don't clog up Node's event loop or the external API
        const matchHistoryRecords: any[] = [];

        for (let i = 0; i < batchTokenIds.length; i += CONCURRENCY_LIMIT) {
            const chunkTokenIds = batchTokenIds.slice(i, i + CONCURRENCY_LIMIT);

            const fetchPromises = chunkTokenIds.map(async (tokenId) => {
                const apiUrl = `https://api.grandarena.gg/api/v1/mokis/${tokenId}/performances?page=1&limit=10`;
                try {
                    const response = await fetch(apiUrl, {
                        headers: {
                            'Accept': 'application/json',
                            'Authorization': `Bearer ${GA_API_KEY}`
                        },
                        // Increased to 15 seconds so we don't abort slower API fetches
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
        }

        // 4. Batch Upsert to Supabase
        let recordsUpserted = 0;
        if (matchHistoryRecords.length > 0) {
            console.log(`[Cron Matches] Upserting ${matchHistoryRecords.length} records...`);

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

        // 5. Save next cursor position
        let nextIndex = startIndex + batchTokenIds.length;
        if (nextIndex >= allTokenIds.length) nextIndex = 0;

        await supabaseAdmin.from('sync_logs').insert({
            status: 'matches_cursor',
            cards_updated: recordsUpserted,
            details: `${nextIndex}`
        });

        // 6. Housekeeping: Keep only the latest 20 matches per Moki ID
        console.log(`[Cron Matches] Running housekeeping to clean up older records...`);
        const { data: allMatches, error: cleanupFetchErr } = await supabaseAdmin
            .from('moki_match_history')
            .select('id, moki_id, created_at')
            .order('created_at', { ascending: false });

        let recordsDeleted = 0;

        if (cleanupFetchErr) {
            console.error(`[Cron Matches] Failed to fetch for housekeeping`, cleanupFetchErr);
        } else if (allMatches) {
            const matchCounts = new Map<string, number>();
            const idsToDelete: number[] = [];

            for (const match of allMatches) {
                const count = matchCounts.get(match.moki_id) || 0;
                if (count >= 20) { // Keep only 20
                    idsToDelete.push(match.id);
                } else {
                    matchCounts.set(match.moki_id, count + 1);
                }
            }

            if (idsToDelete.length > 0) {
                console.log(`[Cron Matches] Found ${idsToDelete.length} ancient matches. Deleting to free space...`);
                // Batch delete in chunks of 500
                const CHUNK_SIZE = 500;
                for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
                    const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
                    const { error: delErr } = await supabaseAdmin
                        .from('moki_match_history')
                        .delete()
                        .in('id', chunk);

                    if (delErr) {
                        console.error(`[Cron Matches] Error deleting chunk:`, delErr);
                    } else {
                        recordsDeleted += chunk.length;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            processedMokis: batchTokenIds.length,
            recordsUpserted: recordsUpserted,
            recordsDeleted: recordsDeleted,
            nextIndex: nextIndex
        });

    } catch (error: any) {
        console.error('[Cron Matches] Fatal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
