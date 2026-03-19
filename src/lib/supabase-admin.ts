import { createClient } from '@supabase/supabase-js';
import 'server-only';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase URL or Service Role Key');
}

// Admin Client (Write Access / Bypass RLS)
// Only use this in trusted server environments (API Routes, Server Actions, Scripts)
export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
