import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar variables de entorno de .env.local
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const GA_API_KEY = process.env.GA_API_KEY;
const METADATA_PATH = path.join(__dirname, '../data/mokiMetadata.json');
const OUTPUT_JSON_PATH = path.join(__dirname, '../data/moki_stars_data.json');
const OUTPUT_SQL_PATH = path.join(__dirname, '../data/update_moki_stars.sql');

if (!GA_API_KEY) {
  console.error('❌ Error: GA_API_KEY no encontrada en .env.local');
  process.exit(1);
}

// Configuración de Throttling
const CONCURRENCY = 5; // Máximo 5 peticiones simultáneas
const RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY = 2000; // 2 segundos base para backoff

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(id: string, attempt = 1): Promise<{ id: string, rank: number | null }> {
  const url = `https://api.grandarena.gg/api/v1/card-defs?page=1&limit=1&cardType=champion&mokiTokenId=${id}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GA_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 429) {
      if (attempt <= RETRY_ATTEMPTS) {
        const waitTime = BASE_RETRY_DELAY * Math.pow(2, attempt - 1);
        console.warn(`⏳ Rate limit en ID ${id} (intento ${attempt}). Esperando ${waitTime}ms...`);
        await sleep(waitTime);
        return fetchWithRetry(id, attempt + 1);
      } else {
        console.error(`❌ ID ${id}: Rate limit excedido tras ${RETRY_ATTEMPTS} reintentos.`);
        return { id, rank: null };
      }
    }

    if (!response.ok) {
      console.error(`⚠️ Error ID ${id}: ${response.status} ${response.statusText}`);
      return { id, rank: null };
    }

    const json = (await response.json()) as { data?: { rank?: number }[] };
    const rank = json.data?.[0]?.rank;
    
    if (rank !== undefined) {
      console.log(`✅ ID ${id}: Rank ${rank}`);
      return { id, rank };
    } else {
      console.warn(`❓ ID ${id}: Rank no encontrado en la respuesta`);
      return { id, rank: null };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Fallo crítico ID ${id}:`, msg);
    return { id, rank: null };
  }
}

// Función para procesar un array en baches con límite de concurrencia
async function processInBatches(ids: string[], limit: number) {
  const results: Record<string, number> = {};
  
  for (let i = 0; i < ids.length; i += limit) {
    const batch = ids.slice(i, i + limit);
    console.log(`\n📦 Procesando grupo ${Math.floor(i / limit) + 1}/${Math.ceil(ids.length / limit)}...`);
    
    const batchPromises = batch.map(id => fetchWithRetry(id));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(res => {
      if (res.rank !== null) {
        results[res.id] = res.rank;
      }
    });

    // Pequeño descanso entre grupos para evitar ráfagas
    await sleep(1000);
  }
  
  return results;
}

async function run() {
  console.log('🚀 Iniciando sincronización robusta (Concurrencia: ' + CONCURRENCY + ')...');

  if (!fs.existsSync(METADATA_PATH)) {
    console.error(`❌ No se encontró ${METADATA_PATH}`);
    process.exit(1);
  }

  const mokiMetadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
  const allMokis = Object.values(mokiMetadata) as Record<string, unknown>[];
  const ids = Array.from(new Set(allMokis.map((m) => String(m.id)).filter((id) => !!id))) as string[];
  
  console.log(`📦 IDs únicos a procesar: ${ids.length}`);

  const results = await processInBatches(ids, CONCURRENCY);

  // Guardar JSON
  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(results, null, 2));
  console.log(`\n💾 Resultados guardados en ${OUTPUT_JSON_PATH}`);

  // Generar SQL
  const sqlLines = [
    '-- Script de actualización de estrellas (stars) en moki_stats',
    '-- Sincronizado el ' + new Date().toLocaleString(),
    'BEGIN;',
    ''
  ];

  Object.entries(results).forEach(([id, rank]) => {
    sqlLines.push(`UPDATE moki_stats SET stars = ${rank} WHERE moki_id = ${id};`);
  });

  sqlLines.push('', 'COMMIT;');
  fs.writeFileSync(OUTPUT_SQL_PATH, sqlLines.join('\n'));
  console.log(`💾 SQL generado en ${OUTPUT_SQL_PATH}`);

  console.log(`\n✨ Proceso completado. Se obtuvieron ${Object.keys(results).length}/${ids.length} rangos.`);
}

run().catch((err) => {
  console.error('💥 Error global:', err);
  process.exit(1);
});
