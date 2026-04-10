/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { parse } from 'csv-parse/sync';
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

      // Update upcoming matches JSONB before re-ranking
      console.log(`[Cron Sync Moki] Updating upcoming_matches_ga with new classes...`);
      try {
        const { data: upcomingMatches, error: upcomingErr } = await supabaseAdmin
          .from('upcoming_matches_ga')
          .select('id, team_red, team_blue');

        if (upcomingErr) {
          console.error('[Cron Sync Moki] Error fetching upcoming matches:', upcomingErr);
        } else if (upcomingMatches && upcomingMatches.length > 0) {
          const classChangeMap = new Map(classChanges.map(c => [c.moki_id, c.new_class]));
          const matchesToUpdate: any[] = [];

          for (const match of upcomingMatches) {
            let modified = false;

            const processTeam = (team: any[]) => {
              if (!team || !Array.isArray(team)) return team;
              return team.map(player => {
                const tokenId = player.mokiTokenId || player.tokenId;
                const tokenIdNum = typeof tokenId === 'number' ? tokenId : parseInt(tokenId, 10);
                if (classChangeMap.has(tokenIdNum) && player.class !== classChangeMap.get(tokenIdNum)) {
                  modified = true;
                  return { ...player, class: classChangeMap.get(tokenIdNum) };
                }
                return player;
              });
            };

            const newTeamRed = processTeam(match.team_red);
            const newTeamBlue = processTeam(match.team_blue);

            if (modified) {
              matchesToUpdate.push({
                id: match.id,
                team_red: newTeamRed,
                team_blue: newTeamBlue
              });
            }
          }

          if (matchesToUpdate.length > 0) {
            console.log(`[Cron Sync Moki] Modifying ${matchesToUpdate.length} upcoming matches...`);
            // Batch update using upsert
            const DB_CHUNK_SIZE = 100;
            for (let i = 0; i < matchesToUpdate.length; i += DB_CHUNK_SIZE) {
              const chunk = matchesToUpdate.slice(i, i + DB_CHUNK_SIZE);
              const { error: upsertErr } = await supabaseAdmin
                .from('upcoming_matches_ga')
                .upsert(chunk, { onConflict: 'id' });
              if (upsertErr) {
                console.error('[Cron Sync Moki] Error updating upcoming matches chunk:', upsertErr);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Cron Sync Moki] Failed to update upcoming matches:', err);
      }

      // Trigger ML Re-Ranking (solo regenerar predicciones con las clases actualizadas)
      console.log(`[Cron Sync Moki] Class change detected (${classChanges.length} changes). Triggering ML re-ranking...`);
      try {
        const projectRoot = path.resolve(__dirname, '../../');
        let mlDir = path.join(projectRoot, 'ml');
        if (!fs.existsSync(mlDir)) mlDir = path.join(projectRoot, 'ML');

        let pythonCommand = process.platform === 'win32'
          ? '.\\venv\\Scripts\\python.exe'
          : './venv/bin/python';
        if (process.env.GITHUB_ACTIONS === 'true') pythonCommand = 'python3';

        const mlOutput = execSync(`${pythonCommand} 5_generate_rank.py`, {
          cwd: mlDir,
          env: { ...process.env },
        });
        console.log(`[Cron Sync Moki] Ranking regenerated:\n${mlOutput.toString()}`);

        // Sync Global Ranking CSV
        const csvPath = path.join(mlDir, 'data', 'upcoming_180_ranking.csv');
        if (fs.existsSync(csvPath)) {
          const records = parse(fs.readFileSync(csvPath, 'utf8'), {
            columns: true, skip_empty_lines: true, trim: true, bom: true,
          });

          const rankingUpserts = records.map((r: any) => ({
            moki_id: parseInt(r['Moki ID']),
            name: r['Name'],
            class: r['Class'],
            score: parseFloat(r['Score']),
            win_rate: parseFloat(r['WinRate']),
            wart_closer: parseFloat(r['Wart Closer']),
            losses: parseFloat(r['Losses']),
            gacha_pts: parseFloat(r['Gacha Pts']),
            deaths: parseFloat(r['Deaths']),
            kills: parseFloat(r['Kills'] || '0'),
            win_by_combat: parseFloat(r['Win By Combat']),
            fur: r['Fur'],
            traits: r['Traits'],
            eliminations_pct: parseFloat(r['Win Cond: Eliminations (%)']),
            wart_pct: parseFloat(r['Win Cond: Wart (%)']),
            gacha_pct: parseFloat(r['Win Cond: Gacha (%)']),
            updated_at: new Date().toISOString(),
          }));

          await supabaseAdmin.from('moki_predictions_ranking').delete().neq('id', 0);
          await supabaseAdmin.from('moki_predictions_ranking').insert(rankingUpserts);
          console.log(`[Cron Sync Moki] Global ranking refreshed: ${rankingUpserts.length} records.`);
          
          await supabaseAdmin.from('sync_logs').insert({
            job_type: 'ML_RANKING_CLASS_CHANGE',
            status: 'success',
            cards_updated: rankingUpserts.length,
            details: `Regenerated ranking due to ${classChanges.length} class changes.`,
          });
        }
      } catch (reRankErr: any) {
        console.error('[Cron Sync Moki] Re-ranking failed (non-fatal):', reRankErr.message);
        await supabaseAdmin.from('sync_logs').insert({
          job_type: 'ML_RANKING_CLASS_CHANGE',
          status: 'error',
          details: `Re-ranking failed: ${reRankErr.message}`,
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
