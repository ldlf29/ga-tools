/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@supabase/supabase-js';

// Anon client (same as frontend)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Count with ADMIN key (bypasses RLS)
  const { count: adminCount, error: adminCountErr } = await supabaseAdmin
    .from('upcoming_matches_ga')
    .select('*', { count: 'exact', head: true });

  results.admin_count = adminCount;
  results.admin_count_error = adminCountErr?.message ?? null;

  // 2. Count with ANON key (subject to RLS)
  const { count: anonCount, error: anonCountErr } = await supabaseAnon
    .from('upcoming_matches_ga')
    .select('*', { count: 'exact', head: true });

  results.anon_count = anonCount;
  results.anon_count_error = anonCountErr?.message ?? null;

  // 3. Fetch first 5 rows with admin key — check team_red/team_blue structure
  const { data: sampleRows, error: sampleErr } = await supabaseAdmin
    .from('upcoming_matches_ga')
    .select('id, team_red, team_blue')
    .limit(5);

  results.sample_error = sampleErr?.message ?? null;
  results.sample_rows = (sampleRows ?? []).map((row) => ({
    id: row.id,
    team_red_length: Array.isArray(row.team_red) ? row.team_red.length : 'NOT_ARRAY',
    team_blue_length: Array.isArray(row.team_blue) ? row.team_blue.length : 'NOT_ARRAY',
    team_red_0_keys: row.team_red?.[0] ? Object.keys(row.team_red[0]) : [],
    team_red_0_name: row.team_red?.[0]?.name ?? '⚠️ NO NAME FIELD',
    team_red_0_mokiTokenId: row.team_red?.[0]?.mokiTokenId ?? 'n/a',
    team_blue_0_name: row.team_blue?.[0]?.name ?? '⚠️ NO NAME FIELD',
  }));

  // 4. Analyze unique names in team_red[0] across 50 rows (admin)
  const { data: nameCheckRows, error: nameCheckErr } = await supabaseAdmin
    .from('upcoming_matches_ga')
    .select('team_red, team_blue')
    .limit(50);

  results.name_check_error = nameCheckErr?.message ?? null;

  const redNames = new Set<string>();
  const blueNames = new Set<string>();
  let redMissingName = 0;
  let blueMissingName = 0;

  for (const row of nameCheckRows ?? []) {
    const redChamp = row.team_red?.[0];
    const blueChamp = row.team_blue?.[0];
    if (redChamp?.name) redNames.add(redChamp.name);
    else redMissingName++;
    if (blueChamp?.name) blueNames.add(blueChamp.name);
    else blueMissingName++;
  }

  results.name_analysis_from_50_rows = {
    unique_red_names: redNames.size,
    unique_blue_names: blueNames.size,
    red_missing_name_count: redMissingName,
    blue_missing_name_count: blueMissingName,
    red_names_sample: Array.from(redNames).slice(0, 10),
    blue_names_sample: Array.from(blueNames).slice(0, 10),
  };

  return NextResponse.json(results, { status: 200 });
}
