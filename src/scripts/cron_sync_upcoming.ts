/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

  console.log('[Cron Upcoming] Buscando el contest principal (SOLO 10-round)...');
  const now = Date.now();
  
  // 1. Filtrar solo por contests que tengan '10-round' en su nombre
  const relevantContests = activeContests.filter((c: any) => 
    c.name?.toLowerCase().includes('10-round')
  );

  if (relevantContests.length === 0) {
    console.warn('[Cron Upcoming] No se encontró ningún contest "10-round" en la lista de activos.');
    return;
  }

  // 2. Encontrar el contest que empieza en el futuro más cercano
  const futureContests = relevantContests
    .map((c: any) => ({
      ...c,
      diff: c.startDate ? new Date(c.startDate).getTime() - now : -Infinity
    }))
    .filter((c: any) => c.diff > 0) // Solo hacia adelante (futuro)
    .sort((a: any, b: any) => a.diff - b.diff); // El más cercano primero

  const contest = futureContests[0];

  if (!contest) {
    console.log('[Cron Upcoming] No se encontró ningún contest "10-round" futuro. Probablemente ya empezaron todos.');
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

  // Build moki_id → class map from moki_stats (stable ID-based lookup)
  const mokiStatsIdMap = new Map<number, string>();
  for (const row of mokiStatsData || []) {
    if (row.moki_id && row.class) {
      mokiStatsIdMap.set(row.moki_id, row.class);
    }
  }
  console.log(`[Cron Upcoming] Loaded ${mokiStatsIdMap.size} moki stats for class override.`);

  // 2. Extraer Partidos Secuencialmente con Reintentos (Evita 524 timeouts)
  console.log('[Cron Upcoming] Extrayendo partidos (Paginado dinámico con reintentos)...');
  
  const fetchPageWithRetry = async (page: number, retries = 3): Promise<any[]> => {
    const url = `${API_BASE_URL}/contests/${contestId}/matches?page=${page}&limit=100&state=scheduled`;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, { 
          headers,
          // Signal para timeout local de 60s
          signal: AbortSignal.timeout(60000) 
        });
        
        if (response.ok) {
          const json = (await response.json()) as any;
          return json.data || [];
        }

        if (response.status === 524 || response.status >= 500) {
          console.warn(`[Cron Upcoming] Página ${page} intento ${attempt} falló (${response.status}). Reintentando en 3s...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }

        console.error(`[Cron Upcoming] Página ${page} error fatal: ${response.status}`);
        return [];
      } catch (err: any) {
        console.warn(`[Cron Upcoming] Página ${page} intento ${attempt} error de red: ${err.message}. Reintentando...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    return [];
  };

  const upcomingInserts: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 25) { // Safety cap en 25 páginas
    const matches = await fetchPageWithRetry(page);
    
    if (matches.length === 0) {
      console.log(`[Cron Upcoming] Página ${page} vacía. Fin de la extracción.`);
      hasMore = false;
      break;
    }

    console.log(`[Cron Upcoming] Página ${page}: Procesando ${matches.length} partidos.`);
    
    for (const match of matches) {
      if (!match || !match.id) continue;
      if (match.isBye) continue;
      if (!match.players || match.players.length === 0) continue;

      const overrideClass = (p: any) => {
        const tokenId = p.mokiTokenId;
        if (tokenId) {
          const statsClass = mokiStatsIdMap.get(tokenId);
          if (statsClass) p.class = statsClass;
        }
        return p;
      };

      const sortChampFirst = (players: any[]) =>
        [...players].sort((a: any, b: any) => {
          const aIsChamp = mokiStatsIdMap.has(a.mokiTokenId) ? 0 : 1;
          const bIsChamp = mokiStatsIdMap.has(b.mokiTokenId) ? 0 : 1;
          return aIsChamp - bIsChamp;
        });

      const teamRed  = sortChampFirst(match.players.filter((p: any) => p.team === 'red').map(overrideClass));
      const teamBlue = sortChampFirst(match.players.filter((p: any) => p.team === 'blue').map(overrideClass));

      // Extraer los campeones (posición 0 tras ordenar con sortChampFirst)
      const redChamp  = teamRed[0];
      const blueChamp = teamBlue[0];

      upcomingInserts.push({
        id: match.id,
        contest_id: contestId,
        match_date: contest.startDate ? new Date(contest.startDate).toISOString() : new Date().toISOString(),
        // Columnas relacionales para queries rápidas
        red_champ_id:    redChamp?.mokiTokenId  ?? null,
        red_champ_class: redChamp?.class        ?? null,
        blue_champ_id:   blueChamp?.mokiTokenId ?? null,
        blue_champ_class: blueChamp?.class      ?? null,
        // JSONB completo para el pipeline de Python
        team_red:  teamRed,
        team_blue: teamBlue,
      });
    }

    if (matches.length < 100) {
      console.log(`[Cron Upcoming] Página ${page} tiene menos de 100 resultados (${matches.length}). Asumiendo última página.`);
      hasMore = false;
    } else {
      page++;
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
      job_type: 'UPCOMING_MATCHES',
      status: 'success',
      cards_updated: recordsUpserted,
      details: `Processed ${recordsUpserted} matches for contest ${contestId}.`,
    });

  } else {
    console.log('[Cron Upcoming] No hay partidos válidos para insertar.');
  }

  console.log(`[Cron Upcoming] Duration: ${Date.now() - startTime}ms`);
}

run().catch((e) => {
  console.error('Fatal Error:', e);
  process.exit(1);
});
