/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carga de variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LEADERBOARD_ID = '6997a23dfe65385c3bd784e5';
const API_URL_BASE = `https://api.grandarena.gg/api/v1/leaderboards/${LEADERBOARD_ID}/scores`;

async function run() {
  console.log('[Cron S1 Scores] Starting Season 1 Scores sync...');
  const startTime = Date.now();

  const GA_API_KEY = process.env.GA_API_KEY;
  if (!GA_API_KEY) {
    console.error('GA_API_KEY is not configured.');
    process.exit(1);
  }

  const results: any[] = [];
  const TOTAL_PAGES = 3; // Covers 240+ mokis in 3 pages (limit=100)

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = `${API_URL_BASE}?page=${page}&limit=100&sort=score&order=desc`;
    console.log(`[Cron S1 Scores] Fetching page ${page}...`);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${GA_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error(`[Cron S1 Scores] API Error on page ${page}: ${response.status}`);
        continue;
      }

      const json = (await response.json()) as any;
      if (json.data && Array.isArray(json.data)) {
        results.push(...json.data);
      }
    } catch (err) {
      console.error(`[Cron S1 Scores] Failed to fetch page ${page}:`, err);
    }
  }

  console.log(`[Cron S1 Scores] Fetched ${results.length} records. Syncing to DB...`);

  // Merge with existing DB data
  const { data: dbStats } = await supabaseAdmin.from('moki_stats').select('*');
  const dbMap = new Map<string, any>();
  if (dbStats) {
    dbStats.forEach((row) => dbMap.set(row.name.trim().toUpperCase(), row));
  }

  const statsUpdates: any[] = [];

  results.forEach((record) => {
    // Safely extract from nested scoreDetail
    const mm = record.scoreDetail?.mokiMayhem || {};
    const mokiName = record.name?.trim();
    if (!mokiName) return;

    const upperName = mokiName.toUpperCase();
    const existing = dbMap.get(upperName) || { name: mokiName };

    statsUpdates.push({
      ...existing,
      eliminations: mm.avgEliminations || 0,
      deposits: mm.avgDeposits || 0,
      wart_distance: mm.avgWartDistance || 0,
      score: mm.avgScore || 0,
      win_rate: mm.winPct || 0,
      last_updated: new Date().toISOString(),
      // Ensure 'class' is maintained. Only overwrite if it was missing and we got it from API.
      class: existing.class || record.class || '',
    });
  });

  // Batch Upsert to Supabase
  const DB_CHUNK_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < statsUpdates.length; i += DB_CHUNK_SIZE) {
    const chunk = statsUpdates.slice(i, i + DB_CHUNK_SIZE);
    const { error } = await supabaseAdmin
      .from('moki_stats')
      .upsert(chunk, { onConflict: 'name' });

    if (error) {
       console.error('[Cron S1 Scores] Error upserting chunk:', error);
       throw error;
    }
    successCount += chunk.length;
  }

  console.log(`[Cron S1 Scores] Sync Complete. Updated ${successCount} Mokis in ${Date.now() - startTime}ms.`);

  await supabaseAdmin.from('sync_logs').insert({
    status: 'success',
    cards_updated: successCount,
    details: `GitHub Action S1 Scores API: Synced ${successCount} Mokis.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
