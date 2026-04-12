/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Build tokenId → canonical name lookup from mokiMetadata
const tokenIdToMeta = new Map<number, { name: string; key: string }>();
Object.entries(mokiMetadata).forEach(([key, meta]) => {
  if (meta.id) {
    tokenIdToMeta.set(parseInt(meta.id, 10), { name: meta.name, key });
  }
});

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
      const apiUrl = `https://api.grandarena.gg/api/v1/mokis/${tokenId}/performances?page=1&limit=20`;
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

            // Use canonical name from mokiMetadata, NOT from API
            const metaEntry = tokenIdToMeta.get(parseInt(tokenId, 10));

            records.push({
              match_id: match.id,
              ga_moki_hash: targetMokiHash,
              moki_id: parseInt(tokenId, 10),
              moki_name: metaEntry?.name || playerInfo?.name || 'Unknown',
              moki_class: playerInfo?.class || '',
              moki_image_url: playerInfo?.imageUrl || '',
              moki_team: playerInfo?.team || 0,
              eliminations: perfResults.eliminations || 0,
              deposits: perfResults.deposits || 0,
              wart_distance: perfResults.wartDistance || 0,
              ended_game: !!perfResults.endedGame,
              deaths: perfResults.deaths || 0,
              eating_while_riding: perfResults.eatingWhileRiding || 0,
              buff_time_seconds: perfResults.buffTimeSeconds || 0,
              wart_ride_time_seconds: perfResults.wartTimeSeconds || perfResults.wartRideTimeSeconds || 0,
              loose_ball_pickups: perfResults.looseBallPickups || 0,
              eaten_by_wart: perfResults.eatenByWart || perfResults.eatenbyWart || 0,
              wart_closer: !!perfResults.wartCloser,
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
        .upsert(chunk, { onConflict: 'ga_moki_hash, match_id' });

      if (upsertErr) {
        console.error('[Cron Matches] Upsert error for chunk:', chunk.length);
        console.dir(upsertErr, { depth: null });
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
      { keep_count: 20 }  // 20 matches por Moki × 240 Mokis = ~4800 filas máx en la tabla
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



  console.log(
    `[Cron Matches] Sync Complete. Upserted ${recordsUpserted}. Duration: ${Date.now() - startTime}ms`
  );

  const { error: logErr } = await supabaseAdmin.from('sync_logs').insert({
    job_type: 'MATCH_HISTORY',
    status: 'success',
    cards_updated: recordsUpserted,
    details: `GitHub Action Matches: Processed ${allTokenIds.length} mokis. Upserted ${recordsUpserted}.`,
  });

  if (logErr) {
    console.error('[Cron Matches] Failed to log to sync_logs:', logErr);
  }
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
