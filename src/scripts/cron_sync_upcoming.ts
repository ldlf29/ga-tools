/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_BASE_URL = 'https://api.grandarena.gg/api/v1';

async function run() {
  console.log('[Cron Upcoming] Starting upcoming matches sync...');
  const startTime = Date.now();

  const GA_API_KEY = process.env.GA_API_KEY;
  if (!GA_API_KEY) {
    console.error('GA_API_KEY is not configured.');
    process.exit(1);
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${GA_API_KEY}`,
  };

  // 1. Obtener ID del Contest Activo
  console.log('[Cron Upcoming] Buscando el contest activo...');
  const contestsRes = await fetch(`${API_BASE_URL}/contests/active?page=1&limit=20`, { headers });
  if (!contestsRes.ok) {
    throw new Error(`Error fetching active contests: ${contestsRes.status}`);
  }

  const contestsJson = (await contestsRes.json()) as any;
  const activeContests = contestsJson.data || [];

  if (activeContests.length === 0) {
    console.log('[Cron Upcoming] No se encontraron contests activos.');
    return;
  }

  console.log('[Cron Upcoming] Buscando el próximo contest Moki Mayhem (Hacia adelante)...');
  const now = Date.now();
  
  let closestContest = null;
  let minDiff = Infinity;
  for (const c of activeContests) {
    if (c.startDate) {
      const contestTime = new Date(c.startDate).getTime();
      const diff = contestTime - now;
      // Solo evaluar los torneos en el futuro
      if (diff > 0 && diff < minDiff) {
        minDiff = diff;
        closestContest = c;
      }
    }
  }

  // Fallback a [0] solo en caso anómalo de que todos hayan empezado
  const contest = closestContest || activeContests[0];

  if (!contest) {
    console.log('[Cron Upcoming] No hay contest de Moki Mayhem activo.');
    return;
  }

  const contestId = contest.id;
  console.log(`[Cron Upcoming] Contest Seleccionado ID: ${contestId} (StartDate UTC: ${contest.startDate})`);

  console.log('[Cron Upcoming] Fetching moki_stats to override classes...');
  const { data: mokiStatsData, error: mokiStatsErr } = await supabaseAdmin
    .from('moki_stats')
    .select('*');

  if (mokiStatsErr) {
    console.error('[Cron Upcoming] Error fetching moki_stats:', mokiStatsErr);
    throw mokiStatsErr;
  }

  const mokiStatsMap = new Map<string, string>();
  for (const row of mokiStatsData || []) {
    if (row.name) {
      mokiStatsMap.set(row.name.trim().toLowerCase(), row.class);
    }
  }
  console.log(`[Cron Upcoming] Loaded ${mokiStatsMap.size} moki stats for class override.`);

  // 2. Extraer Partidos
  console.log('[Cron Upcoming] Extrayendo 900 partidos (9 páginas)...');
  const upcomingInserts: any[] = [];
  const TOTAL_PAGES = 9;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const url = `${API_BASE_URL}/contests/${contestId}/matches?page=${page}&limit=100&state=scheduled`;
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.error(`[Cron Upcoming] API Error page ${page}: ${response.status}`);
        continue;
      }

      const json = (await response.json()) as any;
      const matches = json.data || [];
      if (matches.length === 0) break;

      for (const match of matches) {
        if (!match || !match.id) continue;
        if (match.isBye) continue; // Ignoramos byes (faltas)
        if (!match.players || match.players.length === 0) continue;

        const overrideClass = (p: any) => {
          if (p.name) {
            const key = p.name.trim().toLowerCase();
            const statsClass = mokiStatsMap.get(key);
            if (statsClass) {
              p.class = statsClass;
            }
          }
          return p;
        };

        const teamRed = match.players.filter((p: any) => p.team === 'red').map(overrideClass);
        const teamBlue = match.players.filter((p: any) => p.team === 'blue').map(overrideClass);

        upcomingInserts.push({
          id: match.id,
          contest_id: contestId,
          match_date: contest.startDate ? new Date(contest.startDate).toISOString() : new Date().toISOString(),
          team_red: teamRed,
          team_blue: teamBlue,
        });
      }
    } catch (err) {
      console.error(`[Cron Upcoming] Error fetching page ${page}:`, err);
    }
  }

  console.log(`[Cron Upcoming] Partidos procesados estructurados: ${upcomingInserts.length}`);

  if (upcomingInserts.length > 0) {
    // 3. Recarga Pura a Supabase
    console.log('[Cron Upcoming] Haciendo limpieza (Truncate) e insertando frescos en Supabase...');

    // Primero borramos todo para evitar acumular basura. 
    // Como truncar desde RLS a veces trae problemas, podemos hacer delete * con eq a un valor q no haga match, 
    // o borrar por contest_id != algo, o en Bulk Delete
    const { error: deleteErr } = await supabaseAdmin
      .from('upcoming_matches_ga')
      .delete()
      .neq('id', 'borrar_todo'); // neq a string random borrará toda la tabla (Workaround seguro)

    if (deleteErr) {
      console.error('[Cron Upcoming] Error al vaciar la tabla:', deleteErr);
      throw deleteErr;
    }

    // Insertar en chunks
    const DB_CHUNK_SIZE = 100;
    let recordsUpserted = 0;

    for (let i = 0; i < upcomingInserts.length; i += DB_CHUNK_SIZE) {
      const chunk = upcomingInserts.slice(i, i + DB_CHUNK_SIZE);
      const { error: upsertErr } = await supabaseAdmin
        .from('upcoming_matches_ga')
        .insert(chunk);

      if (upsertErr) {
        console.error('[Cron Upcoming] Insert error:', upsertErr);
        throw upsertErr;
      }
      recordsUpserted += chunk.length;
    }

    console.log(`[Cron Upcoming] Carga completada. Insertados: ${recordsUpserted} partidos.`);

    await supabaseAdmin.from('sync_logs').insert({
      status: 'success',
      cards_updated: recordsUpserted,
      details: `GitHub Action Upcoming Matches: Processed ${recordsUpserted} matches for contest ${contestId}.`,
    });

    // 4. Trigger Automático para el ML Ranking de Python
    console.log('[Cron Upcoming] Disparando script de generación de Ranking ML...');
    try {
      const projectRoot = path.resolve(__dirname, '../../');
      const mlDir = path.join(projectRoot, 'ml');
      const pythonPath = process.platform === 'win32' ? '.\\venv\\Scripts\\python.exe' : './venv/bin/python';
      const mlOutput = execSync(`${pythonPath} 8_generate_rank.py`, { cwd: mlDir });
      console.log(`[Cron Upcoming] Ranking exitoso:\n${mlOutput.toString()}`);
    } catch (mlErr: any) {
      console.error('[Cron Upcoming] Error corriendo la IA:', mlErr.message);
      if (mlErr.stdout) console.log(mlErr.stdout.toString());
      if (mlErr.stderr) console.error(mlErr.stderr.toString());
      // No lanzamos (throw) para no matar la actualización de datos principal
    }
  } else {
    console.log('[Cron Upcoming] No hay partidos válidos para insertar.');
  }

  console.log(`[Cron Upcoming] Duration: ${Date.now() - startTime}ms`);
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
