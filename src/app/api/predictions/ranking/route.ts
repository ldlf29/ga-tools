import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePredictionsAccess, AuthError } from '@/lib/auth-middleware';

// Ranking data is cached for 5 mins as it only updates after periodic ML runs
export const revalidate = 300;

// Seeded shuffle for deterministic-but-fake test data
function shuffleArray<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFakeRanking(real: any[]): any[] {
  const scores = shuffleArray(real.map((r: any) => r['Score']), 42);
  const winRates = shuffleArray(real.map((r: any) => r['WinRate']), 137);
  return real.map((r: any, i: number) => ({
    ...r,
    Score: scores[i],
    WinRate: winRates[i],
    'Gacha Pts': Math.floor(Math.random() * 100),
    'Win By Combat': Math.floor(Math.random() * 50),
  })).sort((a: any, b: any) => (b['Score'] ?? 0) - (a['Score'] ?? 0));
}

export async function GET(req: NextRequest) {
  const isTestMode = req.nextUrl.searchParams.get('mode') === 'test';

  // Real users need a valid session; test mode skips auth (data is fake anyway)
  if (!isTestMode) {
    try {
      await requirePredictionsAccess();
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'ERROR';
      return NextResponse.json({ error: 'NO_ACCESS', code }, { status: 403 });
    }
  }

  try {
    const { data: records, error } = await supabaseAdmin
      .from('moki_predictions_ranking')
      .select('*')
      .order('score', { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
    }
    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'No ranking data found' }, { status: 404 });
    }

    const mapped = records.map((r: any) => ({
      'Moki ID': r.moki_id,
      'Name': r.name,
      'Class': r.class,
      'Score': r.score,
      'WinRate': r.win_rate,
      'Wart Closer': r.wart_closer,
      'Losses': r.losses,
      'Gacha Pts': r.gacha_pts,
      'Deaths': r.deaths,
      'Kills': r.kills,
      'Win By Combat': r.win_by_combat,
      'Fur': r.fur,
      'Traits': r.traits,
      'Win Cond: Eliminations (%)': r.eliminations_pct,
      'Win Cond: Wart (%)': r.wart_pct,
      'Win Cond: Gacha (%)': r.gacha_pct,
    }));

    const finalData = isTestMode ? generateFakeRanking(mapped) : mapped;

    return NextResponse.json({
      success: true,
      data: finalData,
      effectiveDate: records[0]?.effective_date || null,
      timestamp: new Date().toISOString(),
      isTestMode,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load ranking', details: error.message }, { status: 500 });
  }
}
