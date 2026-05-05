/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * upload_v2_rankings.ts
 * =================
 * Lee los CSVs generados por ml/specialized/10_generate_striker_rank.py y
 * ml/specialized/11b_generate_defender_rank.py, y los sube a Supabase
 * en las tablas moki_v2_ranking_striker y moki_v2_ranking_defender.
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

async function uploadRanking(csvFileName: string, tableName: string, role: string) {
  console.log(`[Upload V2 ${role}] Starting upload to ${tableName}...`);
  const startTime = Date.now();

  const csvPath = path.join(__dirname, `../../ml/specialized/data/${csvFileName}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`[Upload V2 ${role}] CSV not found at: ${csvPath}`);
    return 0; // Graceful skip
  }

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

  if (!records || records.length === 0) {
    console.error(`[Upload V2 ${role}] CSV is empty or could not be parsed.`);
    return 0;
  }

  const rankingUpserts = records.map((r: any) => {
    const isStriker = role === 'Striker';
    
    const baseData = {
      moki_id:          parseInt(r['Moki ID']),
      name:             r['Name'],
      class:            r['Class'],
      v2_score:         parseFloat(r['V2 Score'] || '0'),
      v2_win_rate:      parseFloat(r['V2 WinRate'] || '0'),
      matches:          parseInt(r['Matches'] || '1'),
      avg_score:        parseFloat(r['Avg Score Per Match'] || '0'),
      fur:              r['Fur'],
      traits:           r['Traits'],
      updated_at:       new Date().toISOString(),
    };

    if (isStriker) {
      return {
        ...baseData,
        avg_deposits:   parseFloat(r['Avg Predicted Deposits'] || '0'),
        total_deposits: parseFloat(r['Total Deposits'] || '0'),
      };
    } else {
      return {
        ...baseData,
        avg_kills:      parseFloat(r['Avg Predicted Kills'] || '0'),
        avg_wart:       parseFloat(r['Avg Predicted Wart'] || '0'),
        total_kills:    parseFloat(r['Total Predicted Kills'] || '0'),
        total_wart:     parseFloat(r['Total Predicted Wart'] || '0'),
      };
    }
  });

  // Limpiar tabla
  const { error: deleteErr } = await supabaseAdmin
    .from(tableName)
    .delete()
    .neq('id', 0);

  if (deleteErr) {
    console.error(`[Upload V2 ${role}] Error clearing table:`, deleteErr);
    throw deleteErr;
  }

  // Insertar
  const { error: insertErr } = await supabaseAdmin
    .from(tableName)
    .insert(rankingUpserts);

  if (insertErr) {
    console.error(`[Upload V2 ${role}] Error inserting data:`, insertErr);
    throw insertErr;
  }

  console.log(`[Upload V2 ${role}] Done. ${rankingUpserts.length} records uploaded in ${Date.now() - startTime}ms.`);
  return rankingUpserts.length;
}

async function run() {
  try {
    let totalUpdated = 0;
    
    // Subir Striker
    totalUpdated += await uploadRanking('v2_ranking_striker.csv', 'moki_v2_ranking_striker', 'Striker');
    
    // Subir Defender
    totalUpdated += await uploadRanking('v2_ranking_defender.csv', 'moki_v2_ranking_defender', 'Defender');

    await supabaseAdmin.from('sync_logs').insert({
      job_type: 'ML_RANKING_V2',
      status: 'success',
      cards_updated: totalUpdated,
      details: `V2 Re-ranking uploaded: ${totalUpdated} Mokis.`,
    });
  } catch (e) {
    console.error('Fatal Error during V2 Upload:', e);
    await supabaseAdmin.from('sync_logs').insert({
      job_type: 'ML_RANKING_V2',
      status: 'error',
      details: `V2 Upload ranking failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    });
    process.exit(1);
  }
}

run();
