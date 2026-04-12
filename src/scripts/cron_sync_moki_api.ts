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

// Build tokenId → canonical name lookup from mokiMetadata
const tokenIdToMeta = new Map<number, { name: string; key: string }>();
Object.entries(mokiMetadata).forEach(([key, meta]) => {
  if (meta.id) {
    tokenIdToMeta.set(parseInt(meta.id, 10), { name: meta.name, key });
  }
});

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

  // Use moki_id as the lookup key (stable, not name)
  const dbMap = new Map<number, any>();
  if (dbStats) {
    dbStats.forEach((row) => {
      if (row.moki_id) {
        dbMap.set(row.moki_id, row);
      }
    });
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
    // Use mokiTokenId as the stable identifier
    const mokiTokenId = apiMoki.mokiTokenId || apiMoki.tokenId;
    if (!mokiTokenId) {
      console.warn(`[Cron Sync Moki] Skipping moki without mokiTokenId: ${apiMoki.name}`);
      continue;
    }

    const tokenIdNum = typeof mokiTokenId === 'number' ? mokiTokenId : parseInt(mokiTokenId, 10);
    // Get canonical name from mokiMetadata (source of truth)
    const metaEntry = tokenIdToMeta.get(tokenIdNum);
    const canonicalName = metaEntry?.name || apiMoki.name;

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

    // Lookup by moki_id (stable) instead of name (fragile)
    const existingDbRow = dbMap.get(tokenIdNum);
    
    // Si la fila ya existe, conservamos sus estrellas y otros campos calculados
    const oldClass = existingDbRow?.class || '';
    if (oldClass && apiClass && oldClass !== apiClass) {
      classChanges.push({
        moki_id: tokenIdNum,
        moki_name: canonicalName,
        old_class: oldClass,
        new_class: apiClass,
      });
    }

    const mokiUpdate: any = {
      moki_id: tokenIdNum,
      name: canonicalName,
      class: apiClass || oldClass,
      defense: def,
      dexterity: dex,
      fortitude: fort,
      speed: spd,
      strength: str,
      total_stats: totalSum,
      train: totalTrain,
      last_updated: new Date().toISOString(),
    };

    // Solo preservamos la columna 'stars' si ya existe en la DB, 
    // tal como se solicitó para evitar que el cron la sobreescriba.
    if (existingDbRow && existingDbRow.stars !== undefined) {
      mokiUpdate.stars = existingDbRow.stars;
    }

    updatesToSupabase.push(mokiUpdate);
  }

  // A. Class Changes
  if (classChanges.length > 0) {
    console.log(
      `[Cron Sync Moki] Logging ${classChanges.length} class changes...`
    );
    const { error: logErr } = await supabaseAdmin
      .from('class_changes')
      .insert(classChanges);

    if (logErr) {
      console.error('[Cron Sync Moki] Error logging class changes:', logErr);
    } else {
      // Discord notification
      try {
        const { DiscordService } = await import('../services/DiscordService');
        await DiscordService.notifyClassChanges(classChanges);
      } catch (discordErr) {
        console.error(
          '[Cron Sync Moki] Discord notification failed:',
          discordErr
        );
      }

      // Actualizar clases en upcoming_matches_ga con UPDATEs relacionales directos
      // Columnas red_champ_class / blue_champ_class son indexadas por moki_id → O(1) por cambio
      console.log(`[Cron Sync Moki] Updating upcoming_matches_ga classes via relational UPDATE...`);
      try {
        for (const change of classChanges) {
          const { moki_id: changedMokiId, new_class: newClass } = change;

          // Actualizar partidas donde el champion rojo cambió de clase
          const { error: redErr } = await supabaseAdmin
            .from('upcoming_matches_ga')
            .update({ red_champ_class: newClass })
            .eq('red_champ_id', changedMokiId);

          if (redErr) {
            console.warn(`[Cron Sync Moki] Error updating red_champ_class for moki ${changedMokiId}:`, redErr);
          }

          // Actualizar partidas donde el champion azul cambió de clase
          const { error: blueErr } = await supabaseAdmin
            .from('upcoming_matches_ga')
            .update({ blue_champ_class: newClass })
            .eq('blue_champ_id', changedMokiId);

          if (blueErr) {
            console.warn(`[Cron Sync Moki] Error updating blue_champ_class for moki ${changedMokiId}:`, blueErr);
          }
        }
        console.log(`[Cron Sync Moki] Class overrides applied to upcoming matches for ${classChanges.length} Mokis.`);
      } catch (err) {
        console.error('[Cron Sync Moki] Failed to update upcoming match classes:', err);
      }

      // Disparar ML Re-Ranking via GitHub Repository Dispatch (asíncrono, sin bloquear este job)
      console.log(`[Cron Sync Moki] Class change detected (${classChanges.length} changes). Dispatching ML re-rank workflow...`);
      try {
        const ghToken   = process.env.TOKEN_GITHUB;
        const ghOwner   = process.env.GH_REPO_OWNER;
        const ghRepo    = process.env.GH_REPO_NAME;

        if (!ghToken || !ghOwner || !ghRepo) {
          console.warn('[Cron Sync Moki] TOKEN_GITHUB / GH_REPO_OWNER / GH_REPO_NAME not set — skipping dispatch.');
        } else {
          const dispatchUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/dispatches`;
          const dispatchRes = await fetch(dispatchUrl, {
            method: 'POST',
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${ghToken}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event_type: 'class_change_ml',
              client_payload: {
                changed_mokis: classChanges.length,
                triggered_at: new Date().toISOString(),
              },
            }),
          });

          if (dispatchRes.status === 204) {
            console.log('[Cron Sync Moki] ML re-rank workflow dispatched successfully.');
            await supabaseAdmin.from('sync_logs').insert({
              job_type: 'ML_RANKING_CLASS_CHANGE',
              status: 'dispatched',
              cards_updated: classChanges.length,
              details: `Dispatched re-rank workflow for ${classChanges.length} class changes.`,
            });
          } else {
            const body = await dispatchRes.text();
            console.error(`[Cron Sync Moki] Dispatch failed (${dispatchRes.status}):`, body);
            await supabaseAdmin.from('sync_logs').insert({
              job_type: 'ML_RANKING_CLASS_CHANGE',
              status: 'error',
              details: `Dispatch failed (${dispatchRes.status}): ${body}`,
            });
          }
        }
      } catch (dispatchErr: any) {
        console.error('[Cron Sync Moki] Failed to dispatch re-rank workflow:', dispatchErr.message);
        await supabaseAdmin.from('sync_logs').insert({
          job_type: 'ML_RANKING_CLASS_CHANGE',
          status: 'error',
          details: `Dispatch error: ${dispatchErr.message}`,
        });
      }
    }
  }

  // B. Stats Upsert
  if (updatesToSupabase.length > 0) {
    console.log(
      `[Cron Sync Moki] Upserting ${updatesToSupabase.length} Moki stats...`
    );
    // Usamos moki_id como clave de conflicto ya que el usuario confirmó que name ya no es el PK.
    const { error: upsertErr } = await supabaseAdmin
      .from('moki_stats')
      .upsert(updatesToSupabase, { onConflict: 'moki_id' });

    if (upsertErr) {
      console.error('[Cron Sync Moki] Upsert Error:', upsertErr);
      await supabaseAdmin.from('sync_logs').insert({
        job_type: 'MOKI_STATS',
        status: 'error',
        details: `Upsert Error: ${upsertErr.message}`,
      });
      throw upsertErr;
    }
  }

  console.log(
    `[Cron Sync Moki] Sync Complete. Duration: ${Date.now() - startTime}ms`
  );

  await supabaseAdmin.from('sync_logs').insert({
    job_type: 'MOKI_STATS',
    status: 'success',
    cards_updated: updatesToSupabase.length,
    details: `GitHub Action Moki API: Processed ${updatesToSupabase.length} Mokis.`,
  });
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
