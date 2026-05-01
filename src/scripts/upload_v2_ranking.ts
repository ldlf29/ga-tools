/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * upload_v2_ranking.ts
 * ====================
 * Lee el CSV generado por ml/specialized/10_generate_striker_rank.py
 * y lo sube (upsert) a la tabla moki_v2_ranking_striker en Supabase.
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
  console.log('[Upload V2 Ranking] Starting V2 Striker ranking upload...');
  const startTime = Date.now();

  const csvPath = path.join(__dirname, '../../ml/specialized/data/v2_ranking_striker.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`[Upload V2 Ranking] CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!records || records.length === 0) {
    console.error('[Upload V2 Ranking] CSV is empty or could not be parsed.');
    process.exit(1);
  }

  const upserts = records.map((r: any) => ({
    moki_id:      parseInt(r['Moki ID']),
    name:         r['Name'],
    class:        r['Class'],
    v2_score:     parseFloat(r['V2 Score'] || '0'),
    v2_win_rate:  parseFloat(r['V2 WinRate'] || '0'),
    matches:      parseInt(r['Matches'] || '0'),
    avg_score:    parseFloat(r['Avg Score Per Match'] || '0'),
    avg_deposits: parseFloat(r['Avg Predicted Deposits'] || '0'),
    fur:          r['Fur'] || '',
    traits:       r['Traits'] || '',
    updated_at:   new Date().toISOString(),
  }));

  console.log(`[Upload V2 Ranking] Upserting ${upserts.length} striker records...`);

  // Upsert: update if moki_id exists, insert if not
  const { error } = await supabaseAdmin
    .from('moki_v2_ranking_striker')
    .upsert(upserts, { onConflict: 'moki_id' });

  if (error) {
    console.error('[Upload V2 Ranking] Error upserting V2 ranking:', error);
    await supabaseAdmin.from('sync_logs').insert({
      job_type: 'V2_STRIKER_RANKING',
      status: 'error',
      details: `V2 upload failed: ${error.message}`,
    });
    process.exit(1);
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Upload V2 Ranking] Done. ${upserts.length} records upserted in ${elapsed}ms.`);

  await supabaseAdmin.from('sync_logs').insert({
    job_type: 'V2_STRIKER_RANKING',
    status: 'success',
    cards_updated: upserts.length,
    details: `V2 Striker ranking uploaded: ${upserts.length} Mokis.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
