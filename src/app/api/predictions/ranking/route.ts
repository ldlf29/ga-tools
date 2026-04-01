import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch from Supabase instead of local CSV
    const { data: records, error } = await supabaseAdmin
      .from('moki_predictions_ranking')
      .select('*')
      .order('score', { ascending: false });

    if (error) {
      console.error('Supabase error fetching rankings:', error);
      return NextResponse.json({ error: 'Failed to fetch ranking from database' }, { status: 500 });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No ranking data found in database.' }, { status: 404 });
    }

    // Map database columns back to the expected frontend format if necessary
    // or return as is if the frontend can handle the snake_case names.
    // Looking at PredictionsTab.tsx, it likely expects the CSV header names.
    const mappedRecords = records.map((r: any) => ({
      'Moki ID': r.moki_id,
      'Name': r.name,
      'Class': r.class,
      'Score': r.score,
      'WinRate': r.win_rate,
      'Wart Closer': r.wart_closer,
      'Losses': r.losses,
      'Gacha Pts': r.gacha_pts,
      'Deaths': r.deaths,
      'Win By Combat': r.win_by_combat,
      'Fur': r.fur,
      'Traits': r.traits,
      'Win Cond: Eliminations (%)': r.eliminations_pct,
      'Win Cond: Wart (%)': r.wart_pct,
      'Win Cond: Gacha (%)': r.gacha_pct
    }));

    return NextResponse.json({ 
        success: true, 
        data: mappedRecords,
        timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error reading ranking CSV:', error);
    return NextResponse.json({ error: 'Failed to parse ranking data', details: error.message }, { status: 500 });
  }
}
