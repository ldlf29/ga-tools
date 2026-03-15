import { supabaseAdmin } from '../lib/supabase-admin';

async function verify() {
  const { data, error } = await supabaseAdmin
    .from('moki_match_history')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error("Error fetching match history row:", error);
  } else {
    console.log("Match history structure keys:", Object.keys(data[0] || {}));
    console.log("Full sample row:", data[0]);
  }
}

verify();
