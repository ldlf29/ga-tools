const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('moki_stats')
        .select('name, train')
        .eq('name', 'Two')
        .single();

    if (error) {
        console.error(error);
    } else {
        console.log('Result for Two:', data);
    }
}

check();
