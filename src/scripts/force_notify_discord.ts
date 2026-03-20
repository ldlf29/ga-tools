const dotenv = require('dotenv');
const path = require('path');

// 1. Carga de variables de entorno locales
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// 2. Importar módulos con require para evitar hoisting
const { createClient } = require('@supabase/supabase-js');
const { DiscordService } = require('../services/DiscordService');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('🧪 Iniciando script de rescate para Discord...');

  if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CHANNEL_ID) {
    console.error('❌ Error: Falta configuración de Discord en .env.local');
    return;
  }

  try {
    console.log('📦 Obteniendo los últimos 7 cambios de clase de Supabase...');
    const { data: changes, error } = await supabaseAdmin
      .from('class_changes')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(7);

    if (error) {
       console.error('❌ Error leyendo class_changes:', error);
       return;
    }

    if (!changes || changes.length === 0) {
       console.log('⚠️ No se encontraron registros en class_changes.');
       return;
    }

    console.log(`✅ Obtenidos ${changes.length} registros. Formateando...`);
    
    // Adaptar nombres de campos si difieren (el de DiscordService usa snake_case tal como lo inyectamos)
    const formattedChanges = changes.map((c) => ({
       moki_name: c.moki_name,
       old_class: c.old_class,
       new_class: c.new_class
    }));

    console.log('📤 Enviando bloque a Discord...');
    await DiscordService.notifyClassChanges(formattedChanges.reverse()); // Reverse para mandarlos en orden cronológico real
    console.log('🎉 Notificación forzada completada.');

  } catch (e) {
    console.error('❌ Fallo de ejecución:', e);
  }
}

run();
