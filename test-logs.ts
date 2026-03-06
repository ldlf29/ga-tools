import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

async function checkLogs() {
    console.log("🔍 Fetching Recent Sync Logs...");

    const { data: logs, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("❌ Error fetching logs:", error.message);
        return;
    }

    console.log(`\n📅 Most Recent 5 Sync Logs:`);
    for (const log of logs.slice(0, 5)) {
        console.log(`[${log.created_at}] STATUS: ${log.status}`);
        console.log(`   📝 Details: ${log.details}`);
        console.log(`----------------------------------------`);
    }

    console.log("\n🔍 Fetching Recent Class Changes...");

    const { data: changes, error: changeError } = await supabase
        .from('class_changes')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(5);

    if (changeError) {
        console.error("❌ Error fetching class changes:", changeError.message);
        return;
    }

    console.log(`\n📅 Most Recent 5 Class Changes in DB:`);
    for (const change of changes) {
        console.log(`[${change.changed_at}] Moki: ${change.moki_name} | ${change.old_class || 'None'} -> ${change.new_class}`);
    }
}

checkLogs();
