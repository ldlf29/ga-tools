/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * upload_ranking.ts
 * =================
 * Lee el CSV generado por ml/5_generate_rank.py y lo sube a Supabase.
 * Se ejecuta como segundo paso en ml_rerank.yml después de que Python
 * genera el archivo ml/data/upcoming_180_ranking.csv.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('[Upload Ranking] Starting ranking upload to Supabase...');
  const startTime = Date.now();

  const csvPath = path.join(__dirname, '../../ml/data/upcoming_180_ranking.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`[Upload Ranking] CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!records || records.length === 0) {
    console.error('[Upload Ranking] CSV is empty or could not be parsed.');
    process.exit(1);
  }

  const rankingUpserts = records.map((r: any) => ({
    moki_id:          parseInt(r['Moki ID']),
    name:             r['Name'],
    class:            r['Class'],
    score:            parseFloat(r['Score']),
    win_rate:         parseFloat(r['WinRate']),
    wart_closer:      parseFloat(r['Wart Closer']),
    losses:           parseFloat(r['Losses']),
    gacha_pts:        parseFloat(r['Gacha Pts']),
    deaths:           parseFloat(r['Deaths']),
    kills:            parseFloat(r['Kills'] || '0'),
    wart_distance:    parseFloat(r['Wart Distance'] || '0'),
    win_by_combat:    parseFloat(r['Win By Combat']),
    fur:              r['Fur'],
    traits:           r['Traits'],
    eliminations_pct: parseFloat(r['Win Cond: Eliminations (%)']),
    wart_pct:         parseFloat(r['Win Cond: Wart (%)']),
    gacha_pct:        parseFloat(r['Win Cond: Gacha (%)']),
    updated_at:       new Date().toISOString(),
  }));

  console.log(`[Upload Ranking] Uploading ${rankingUpserts.length} records...`);

  // Limpiar tabla y reinsertar atomicamente
  const { error: deleteErr } = await supabaseAdmin
    .from('moki_predictions_ranking')
    .delete()
    .neq('id', 0);

  if (deleteErr) {
    console.error('[Upload Ranking] Error clearing ranking table:', deleteErr);
    process.exit(1);
  }

  const { error: insertErr } = await supabaseAdmin
    .from('moki_predictions_ranking')
    .insert(rankingUpserts);

  if (insertErr) {
    console.error('[Upload Ranking] Error inserting ranking:', insertErr);
    await supabaseAdmin.from('sync_logs').insert({
      job_type: 'ML_RANKING_CLASS_CHANGE',
      status: 'error',
      details: `Upload ranking failed: ${insertErr.message}`,
    });
    process.exit(1);
  }

  console.log(`[Upload Ranking] Done. ${rankingUpserts.length} records uploaded in ${Date.now() - startTime}ms.`);

  await supabaseAdmin.from('sync_logs').insert({
    job_type: 'ML_RANKING',
    status: 'success',
    cards_updated: rankingUpserts.length,
    details: `Re-ranking uploaded: ${rankingUpserts.length} Mokis.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
