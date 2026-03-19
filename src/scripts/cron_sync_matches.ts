import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import mokiMetadataRaw from '../data/mokiMetadata.json';

// Carga de variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // IMPORTANTE: Service Role para bypass RLS
);

const mokiMetadata = mokiMetadataRaw as Record<string, any>;
const CONCURRENCY_LIMIT = 20;
const DELAY_BETWEEN_BATCHES = 2000;

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mapTeamToNumber = (team: any): number => {
  if (typeof team === 'string') {
    const t = team.toLowerCase();
    if (t === 'red') return 1;
    if (t === 'blue') return 2;
  }
  return typeof team === 'number' ? team : 0;
};

async function run() {
  console.log('[Cron Matches] Starting Full Match Sync...');
  const startTime = Date.now();

  const GA_API_KEY = process.env.GA_API_KEY;
  if (!GA_API_KEY) {
    console.error('GA_API_KEY is not configured.');
    process.exit(1);
  }

  const allTokenIds = Object.values(mokiMetadata)
    .map((m) => m.id)
    .filter((id) => !!id);

  console.log(
    `[Cron Matches] Fetching matches for ${allTokenIds.length} Mokis...`
  );
  const matchHistoryRecords: any[] = [];

  for (let i = 0; i < allTokenIds.length; i += CONCURRENCY_LIMIT) {
    const chunkTokenIds = allTokenIds.slice(i, i + CONCURRENCY_LIMIT);
    console.log(
      `[Cron Matches] Fetching Chunk ${i / CONCURRENCY_LIMIT + 1}...`
    );

    const fetchPromises = chunkTokenIds.map(async (tokenId) => {
      const apiUrl = `https://api.grandarena.gg/api/v1/mokis/${tokenId}/performances?page=1&limit=30`;
      try {
        const response = await fetch(apiUrl, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${GA_API_KEY}`,
          },
        });

        if (!response.ok) {
          console.error(
            `[Cron Matches] API Error for tokenId ${tokenId}: ${response.status}`
          );
          return [];
        }

        const json = (await response.json()) as any;
        const performances = json.data;
        const records: any[] = [];

        if (performances && Array.isArray(performances)) {
          for (const perf of performances) {
            const match = perf.match;
            if (!match || !match.result) continue;

            if (match.players) {
              match.players = match.players.map((p: any) => ({
                ...p,
                team: mapTeamToNumber(p.team),
              }));
            }
            if (match.result) {
              match.result.teamWon = mapTeamToNumber(match.result.teamWon);
            }

            const targetMokiHash = perf.mokiId;
            const playerInfo = match.players?.find(
              (p: any) => p.mokiId === targetMokiHash
            );
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
              win_type:
                match.result.winType === 'Eliminations'
                  ? 'Combat'
                  : match.result.winType || 'unknown',
              team_won: match.result.teamWon || 0,
              duration: match.result.duration || 0,
              match_date:
                perf.matchDate ||
                match.matchDate ||
                new Date().toISOString().split('T')[0],
              match_data: match,
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

    if (i + CONCURRENCY_LIMIT < allTokenIds.length) {
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }

  let recordsUpserted = 0;
  if (matchHistoryRecords.length > 0) {
    console.log(
      `[Cron Matches] Upserting ${matchHistoryRecords.length} records to DB...`
    );
    const DB_CHUNK_SIZE = 100;

    for (let i = 0; i < matchHistoryRecords.length; i += DB_CHUNK_SIZE) {
      const chunk = matchHistoryRecords.slice(i, i + DB_CHUNK_SIZE);
      const { error: upsertErr } = await supabaseAdmin
        .from('moki_match_history')
        .upsert(chunk, { onConflict: 'moki_id, match_id' });

      if (upsertErr) {
        console.error('[Cron Matches] Upsert error:', upsertErr);
        throw upsertErr;
      }
      recordsUpserted += chunk.length;
    }
  }

  // Housekeeping
  let recordsDeleted = 0;
  try {
    const { data: deletedData, error: cleanupErr } = await supabaseAdmin.rpc(
      'cleanup_old_matches',
      { keep_count: 40 }
    );

    if (cleanupErr) {
      console.error(`[Cron Matches] Housekeeping SQL error:`, cleanupErr);
    } else {
      recordsDeleted = deletedData ?? 0;
      console.log(
        `[Cron Matches] Housekeeping: deleted ${recordsDeleted} old matches.`
      );
    }
  } catch (err) {
    console.error(`[Cron Matches] Housekeeping failed:`, err);
  }

  // Leaderboard
  try {
    const { error: rpcErr } = await supabaseAdmin.rpc(
      'update_daily_leaderboard'
    );
    if (rpcErr) console.error('[Cron Matches] Leaderboard RPC error:', rpcErr);
    else console.log('[Cron Matches] Daily leaderboard updated successfully.');
  } catch (err) {
    console.error('[Cron Matches] Leaderboard RPC failed:', err);
  }

  console.log(
    `[Cron Matches] Sync Complete. Upserted ${recordsUpserted}. Duration: ${Date.now() - startTime}ms`
  );

  await supabaseAdmin.from('sync_logs').insert({
    status: 'success',
    cards_updated: recordsUpserted,
    details: `GitHub Action Matches: Processed ${allTokenIds.length} mokis. Upserted ${recordsUpserted}.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
