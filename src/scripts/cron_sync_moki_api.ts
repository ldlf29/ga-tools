/* eslint-disable @typescript-eslint/no-explicit-any */
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
const BATCH_SIZE = 90;

async function run() {
  console.log('[Cron Sync Moki] Starting bulk Game API sync...');
  const startTime = Date.now();

  const GA_API_KEY = process.env.GA_API_KEY;
  if (!GA_API_KEY) {
    console.error('GA_API_KEY is not configured.');
    process.exit(1);
  }

  // 1. Fetch from Supabase
  const { data: dbStats, error: dbError } = await supabaseAdmin
    .from('moki_stats')
    .select('*');

  if (dbError) {
    console.error('Supabase error:', dbError);
    process.exit(1);
  }

  const dbMap = new Map<string, any>();
  if (dbStats) {
    dbStats.forEach((row) => dbMap.set(row.name.trim().toUpperCase(), row));
  }

  const allIds = Object.values(mokiMetadata)
    .map((m) => m.id)
    .filter((id) => !!id);

  console.log(`[Cron Sync Moki] Fetching stats for ${allIds.length} Mokis...`);
  const apiResults: any[] = [];

  for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
    const batchIds = allIds.slice(i, i + BATCH_SIZE);
    const apiUrl = `https://api.grandarena.gg/api/v1/mokis/bulk?ids=${batchIds.join(',')}`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${GA_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error(
        `[Cron Sync Moki] Game API error on batch ${i}: ${response.status}`
      );
      continue;
    }

    const json = (await response.json()) as any;
    if (json && json.data && Array.isArray(json.data)) {
      apiResults.push(...json.data);
    }
  }

  console.log(
    `[Cron Sync Moki] Received ${apiResults.length} records from API.`
  );

  const updatesToSupabase: any[] = [];
  const classChanges: any[] = [];

  for (const apiMoki of apiResults) {
    const mokiName = apiMoki.name;
    if (!mokiName) continue;

    const upperName = mokiName.trim().toUpperCase();
    const gameStats = apiMoki.gameStats || {};
    const stats = gameStats.stats || {};
    const apiClass = gameStats.class || '';

    const str = stats.strength?.total || 0;
    const spd = stats.speed?.total || 0;
    const def = stats.defense?.total || 0;
    const dex = stats.dexterity?.total || 0;
    const fort = stats.fortitude?.total || 0;

    const trainStr = stats.strength?.training || 0;
    const trainSpd = stats.speed?.training || 0;
    const trainDef = stats.defense?.training || 0;
    const trainDex = stats.dexterity?.training || 0;
    const trainFort = stats.fortitude?.training || 0;
    const totalTrain = trainStr + trainSpd + trainDef + trainDex + trainFort;

    const totalSum = str + spd + def + dex + fort;

    const existingDbRow = dbMap.get(upperName) || {
      name: mokiName,
      eliminations: 0,
      deposits: 0,
      wart_distance: 0,
      score: 0,
      win_rate: 0,
      stars: 0,
    };

    const oldClass = existingDbRow.class || '';
    if (oldClass && oldClass !== apiClass && apiClass !== '') {
      classChanges.push({
        moki_name: mokiName,
        old_class: oldClass,
        new_class: apiClass,
      });
    }

    updatesToSupabase.push({
      ...existingDbRow,
      name: mokiName,
      class: apiClass || oldClass,
      defense: def,
      dexterity: dex,
      fortitude: fort,
      speed: spd,
      strength: str,
      total_stats: totalSum,
      train: totalTrain,
      last_updated: new Date().toISOString(),
    });
  }

  // A. Class Changes
  if (classChanges.length > 0) {
    console.log(
      `[Cron Sync Moki] Logging ${classChanges.length} class changes...`
    );
    const { error: logErr } = await supabaseAdmin
      .from('class_changes')
      .insert(classChanges);

    if (logErr)
      console.error('[Cron Sync Moki] Error logging class changes:', logErr);
    else {
      try {
        const { DiscordService } = await import('../services/DiscordService');
        await DiscordService.notifyClassChanges(classChanges);
      } catch (discordErr) {
        console.error(
          '[Cron Sync Moki] Discord notification failed:',
          discordErr
        );
      }
    }
  }

  // B. Stats Upsert
  if (updatesToSupabase.length > 0) {
    console.log(
      `[Cron Sync Moki] Upserting ${updatesToSupabase.length} Moki stats...`
    );
    const { error: upsertErr } = await supabaseAdmin
      .from('moki_stats')
      .upsert(updatesToSupabase, { onConflict: 'name' });

    if (upsertErr) console.error('[Cron Sync Moki] Upsert Error:', upsertErr);
  }

  console.log(
    `[Cron Sync Moki] Sync Complete. Duration: ${Date.now() - startTime}ms`
  );

  await supabaseAdmin.from('sync_logs').insert({
    status: 'success',
    cards_updated: updatesToSupabase.length,
    details: `GitHub Action Moki API: Processed ${updatesToSupabase.length} Mokis.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
