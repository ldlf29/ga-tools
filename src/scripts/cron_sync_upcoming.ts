/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { parse } from 'csv-parse/sync';

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

  console.log('[Cron Upcoming] Buscando el contest principal (Moki Mayhem o 10-Round)...');
  const now = Date.now();
  
  let selectedContest = null;
  
  // 1. Prioridad Absoluta: 10 Rondas (los de 900+ partidos)
  selectedContest = activeContests.find((c: any) => c.name?.toLowerCase().includes('10-round'));

  // 2. Fallback: Moki Mayhem (si no hay de 10 rondas, pero priorizando el nombre)
  if (!selectedContest) {
    selectedContest = activeContests.find((c: any) => c.name?.toLowerCase().includes('moki mayhem'));
  }

  // 3. Tercera Prioridad: El más cercano en el futuro (mínimo 3-round)
  if (!selectedContest) {
    let minDiff = Infinity;
    for (const c of activeContests) {
      if (c.startDate) {
        const contestTime = new Date(c.startDate).getTime();
        const diff = contestTime - now;
        if (diff > 0 && diff < minDiff) {
          minDiff = diff;
          selectedContest = c;
        }
      }
    }
  }

  const contest = selectedContest || activeContests[0];

  if (!contest) {
    console.log('[Cron Upcoming] No se encontró ningún contest válido.');
    return;
  }

  const contestId = contest.id;
  console.log(`[Cron Upcoming] Contest Seleccionado: "${contest.name}" (ID: ${contestId})`);

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
  // Usamos 15 páginas en lugar de 12 para compensar los Byes y partidos
  // sin players que se filtran. Cada página tiene ~100 entradas brutas,
  // pero solo ~75-80 son partidos reales insertables.
  console.log('[Cron Upcoming] Extrayendo partidos (hasta 15 paginas de 100)...');
  const upcomingInserts: any[] = [];
  const TOTAL_PAGES = 15;

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
      // No cortamos el loop si una página sale vacía; la API puede tener
      // huecos de paginación. Solo continuamos.
      if (matches.length === 0) {
        console.warn(`[Cron Upcoming] Página ${page} vino vacía, continuando...`);
        continue;
      }

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

  if (upcomingInserts.length === 0) {
    console.warn('[Cron Upcoming] ADVERTENCIA: No se encontraron partidos programados para este contest.');
  }

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
      
      // Intentar encontrar la carpeta ml/ML de forma robusta para Linux
      let mlDir = path.join(projectRoot, 'ml');
      if (!fs.existsSync(mlDir)) {
        mlDir = path.join(projectRoot, 'ML');
      }

      if (!fs.existsSync(mlDir)) {
        throw new Error(`Could not find 'ml' or 'ML' directory in ${projectRoot}`);
      }

      console.log(`[Cron Upcoming] Usando directorio ML: ${mlDir}`);
      
      // Borrar CSV anterior si existe antes de generar el nuevo
      const csvPath = path.join(mlDir, 'data', 'upcoming_180_ranking.csv');
      if (fs.existsSync(csvPath)) {
        console.log('[Cron Upcoming] Borrando CSV anterior para asegurar frescura...');
        fs.unlinkSync(csvPath);
      }

      // Determinar el comando de Python: 
      let pythonCommand = process.platform === 'win32' 
        ? '.\\venv\\Scripts\\python.exe' 
        : './venv/bin/python';

      if (process.env.GITHUB_ACTIONS === 'true') {
        pythonCommand = 'python3';
      }

      console.log(`[Cron Upcoming] Usando comando: ${pythonCommand}`);
      
      // 4a. Feedback Loop: Retrain with latest historical matches from Supabase
      console.log('[Cron Upcoming] Ejecutando Retraining (Feedback Loop)...');
      try {
        const retrainOutput = execSync(`${pythonCommand} 10_retrain_from_supabase.py`, { 
          cwd: mlDir,
          env: { ...process.env }
        });
        console.log(`[Cron Upcoming] Retraining completado:\n${retrainOutput.toString()}`);
      } catch (retrainErr: any) {
        console.warn('[Cron Upcoming] Advertencia: El re-entrenamiento falló, se usará el modelo previo.', retrainErr.message);
      }

      // 4b. Ranking Generation
      console.log('[Cron Upcoming] Ejecutando Generación de Ranking (Cascade IA)...');
      const mlOutput = execSync(`${pythonCommand} 8_generate_rank.py`, { 
        cwd: mlDir,
        env: { ...process.env }
      });
      console.log(`[Cron Upcoming] Ranking exitoso. Output completo:\n${mlOutput.toString()}`);

      // 5. Sync Generated CSV to Supabase
      console.log(`[Cron Upcoming] Verificando CSV en: ${csvPath}`);

      if (fs.existsSync(csvPath)) {
        console.log('[Cron Upcoming] Reading Ranking CSV for Supabase Sync...');
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true
        });

        console.log(`[Cron Upcoming] Found ${records.length} ranking records. Mapping and Refreshing Table...`);

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
          effective_date: contest.startDate,
          updated_at: new Date().toISOString()
        }));

        // 5a. Clear Old Ranking
        const { error: clearErr } = await supabaseAdmin
          .from('moki_predictions_ranking')
          .delete()
          .neq('id', 0); // Workaround to delete all rows

        if (clearErr) {
          console.error('[Cron Upcoming] Error clearing old rankings:', clearErr);
        }

        // 5b. Insert Fresh Ranking
        console.log(`[Cron Upcoming] Insertando ${rankingUpserts.length} registros en Supabase...`);
        const { error: rankErr } = await supabaseAdmin
          .from('moki_predictions_ranking')
          .insert(rankingUpserts);

        if (rankErr) {
          console.error('[Cron Upcoming] ERROR FATAL DE INSERCIÓN:', JSON.stringify(rankErr, null, 2));
        } else {
          console.log('[Cron Upcoming] Successfully synced ranking records to Supabase.');
        }

      } else {
        console.warn('[Cron Upcoming] Ranking CSV not found at', csvPath);
      }
    } catch (mlErr: any) {
      console.error('[Cron Upcoming] Error corriendo la IA o sincronizando rankings:', mlErr.message);
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
