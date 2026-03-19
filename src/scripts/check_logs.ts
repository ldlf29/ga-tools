import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  console.log(
    '🔍 Checking Supabase `sync_logs` for latest background executions...'
  );
  const { data: logs, error } = await supabaseAdmin
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching sync logs:', error);
  } else if (!logs || logs.length === 0) {
    console.log('No sync logs found.');
  } else {
    console.log(`Found ${logs.length} latest log entries:`);
    logs.forEach((l: any) => {
      console.log(`\n- [${l.status.toUpperCase()}] at ${l.created_at}`);
      console.log(`  Details: ${l.details}`);
      console.log(`  Cards Updated: ${l.cards_updated}`);
    });
  }
}

checkLogs();
