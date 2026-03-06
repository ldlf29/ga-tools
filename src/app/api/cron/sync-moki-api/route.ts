import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import mokiMetadataRaw from '@/data/mokiMetadata.json';

// Get target IDs from our static database
const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const BATCH_SIZE = 90;

export async function GET(request: NextRequest) {
    // 1. Verify Authentication (via Authorization header only — never via URL params)
    const authHeader = request.headers.get('authorization');
    const CRON_SECRET = process.env.CRON_SECRET;
    const GA_API_KEY = process.env.GA_API_KEY;

    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized. Invalid or missing secret.' }, { status: 401 });
    }

    try {
        console.log('[Cron Sync] Starting bulk Game API sync...');

        // 2. Fetch all existing stats from Supabase to merge and compare
        const { data: dbStats, error: dbError } = await supabaseAdmin
            .from('moki_stats')
            .select('*');

        if (dbError) throw dbError;

        const dbMap = new Map<string, any>();
        if (dbStats) {
            dbStats.forEach(row => {
                // We use UpperCase Name to match safely
                dbMap.set(row.name.trim().toUpperCase(), row);
            });
        }

        // 3. Extract IDs from our metadata
        const allIds = Object.values(mokiMetadata)
            .map(m => m.id)
            .filter(id => !!id);

        if (allIds.length === 0) {
            return NextResponse.json({ message: 'No IDs found to sync.' }, { status: 200 });
        }

        const apiResults = [];

        // 4. Fetch from Game API in batched chunks
        for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
            const batchIds = allIds.slice(i, i + BATCH_SIZE);
            const apiUrl = `https://api.grandarena.gg/api/v1/mokis/bulk?ids=${batchIds.join(',')}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${GA_API_KEY}`
                }
            });
            if (!response.ok) {
                console.error(`[Cron Sync] Game API error on batch ${i}: ${response.status}`);
                continue;
            }

            const json = await response.json();
            if (json && json.data && Array.isArray(json.data)) {
                apiResults.push(...json.data);
            }
        }

        console.log(`[Cron Sync] Received ${apiResults.length} records from Game API.`);

        const updatesToSupabase = [];
        const classChanges = [];

        // 5. Compare and prepare UPSERTs
        for (const apiMoki of apiResults) {
            const mokiName = apiMoki.name;
            if (!mokiName) continue;

            const upperName = mokiName.trim().toUpperCase();

            // Extract base stats
            const gameStats = apiMoki.gameStats || {};
            const stats = gameStats.stats || {};
            const apiClass = gameStats.class || '';

            const str = stats.strength?.total || 0;
            const spd = stats.speed?.total || 0;
            const def = stats.defense?.total || 0;
            const dex = stats.dexterity?.total || 0;
            const fort = stats.fortitude?.total || 0;

            // Extract training values
            const trainStr = stats.strength?.training || 0;
            const trainSpd = stats.speed?.training || 0;
            const trainDef = stats.defense?.training || 0;
            const trainDex = stats.dexterity?.training || 0;
            const trainFort = stats.fortitude?.training || 0;
            const totalTrain = trainStr + trainSpd + trainDef + trainDex + trainFort;

            const totalSum = str + spd + def + dex + fort;

            // Construct UPSERT payload
            const payload = {
                name: mokiName,
                class: apiClass,
                strength: str,
                speed: spd,
                defense: def,
                dexterity: dex,
                fortitude: fort,
                total_stats: totalSum,
                train: totalTrain,
                updated_at: new Date().toISOString()
            };

            // Get the existing DB record to preserve performance stats
            const existingDbRow = dbMap.get(upperName) || {
                name: mokiName,
                eliminations: 0,
                deposits: 0,
                wart_distance: 0,
                score: 0,
                win_rate: 0,
                stars: 0
            };

            // Detect Class Change
            const oldClass = existingDbRow.class || '';
            if (oldClass && oldClass !== apiClass && apiClass !== '') {
                classChanges.push({
                    moki_name: mokiName,
                    old_class: oldClass,
                    new_class: apiClass
                });
            }

            // Prepare the fully merged row
            updatesToSupabase.push({
                ...existingDbRow, // Keeps all performance stats intact!
                name: mokiName, // Primary Key
                class: apiClass || oldClass, // Fallback to old if API returns empty
                defense: def,
                dexterity: dex,
                fortitude: fort,
                speed: spd,
                strength: str,
                total_stats: totalSum,
                train: totalTrain,
                last_updated: new Date().toISOString()
            });
        }

        // 6. Execute Batch Writes to Supabase

        // A. Insert Class Changes
        if (classChanges.length > 0) {
            console.log(`[Cron Sync] Inserting ${classChanges.length} class changes...`);
            const { error: logErr } = await supabaseAdmin
                .from('class_changes')
                .insert(classChanges);
            if (logErr) {
                console.error('[Cron Sync] Error inserting class changes:', logErr);
            } else {
                // Send Discord notification
                try {
                    const { DiscordService } = await import('@/services/DiscordService');
                    await DiscordService.notifyClassChanges(classChanges);
                    console.log('[Cron Sync] Successfully dispatched Discord notification.');
                } catch (discordErr: any) {
                    console.error('[Cron Sync] CRITICAL ERROR Dispatching Discord Notification:', discordErr);
                    // Also attempt to log this to Supabase so it's not totally lost if Vercel logs rotate
                    await supabaseAdmin.from('sync_logs').insert({
                        status: 'error',
                        cards_updated: 0,
                        details: `Discord Notification Failure: ${discordErr.message || String(discordErr)}`
                    });
                }
            }
        }

        // B. Upsert Stats (Upsert will overwrite the full row, but we kept the old performance stats in the object so they are perfectly safe!)
        if (updatesToSupabase.length > 0) {
            console.log(`[Cron Sync] Upserting ${updatesToSupabase.length} Moki stats...`);
            const { error: upsertErr } = await supabaseAdmin
                .from('moki_stats')
                .upsert(updatesToSupabase, { onConflict: 'name' });

            if (upsertErr) throw upsertErr;
        }

        // C. Record Sync Log
        const { error: syncLogErr } = await supabaseAdmin
            .from('sync_logs')
            .insert({
                status: 'success',
                cards_updated: updatesToSupabase.length,
                details: `Cron sync from Game API completed. ${classChanges.length} class changes detected.`
            });

        if (syncLogErr) console.error('[Cron Sync] Error writing sync log:', syncLogErr);

        return NextResponse.json({
            message: 'Game API sync successful.',
            updatedCount: updatesToSupabase.length,
            classChangesDetected: classChanges.length
        }, { status: 200 });

    } catch (e: any) {
        console.error('[Cron Sync] Fatal Error:', e);

        // Log failure
        await supabaseAdmin.from('sync_logs').insert({
            status: 'error',
            cards_updated: 0,
            details: e.message || 'Unknown error during sync'
        });

        return NextResponse.json({ error: 'Failed to sync API data.' }, { status: 500 });
    }
}
