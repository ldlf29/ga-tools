import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Revalidate every 10 minutes (600s) to sync smoothly with the new Cron endpoints
export const revalidate = 600;

export async function GET() {
  console.log('[API Stats] Loading data...');
  try {
    // 1. Fetch all Moki stats
    const { data: globalData, error: globalError } = await supabaseAdmin
      .from('moki_stats')
      .select('*');

    if (globalError) {
      console.error('[API Stats] Moki stats fetch error:', globalError);
      throw globalError;
    }

    if (!globalData) {
      return NextResponse.json({});
    }

    // 2. Fetch match averages via SQL function
    const averagesByName: Record<string, any> = {};
    const { data: avgData, error: avgError } = await supabaseAdmin.rpc(
      'get_moki_match_averages'
    );

    if (avgError) {
      console.warn(
        '[API Stats] Failed to fetch match averages (Function might not exist yet):',
        avgError
      );
    } else if (avgData) {
      console.log(`[API Stats] Fetched averages for ${avgData.length} Mokis`);
      for (const row of avgData) {
        if (!row.moki_name) continue;
        averagesByName[row.moki_name.toUpperCase()] = {
          avgWinRate10: row.avg_win_rate_10 || 0,
          avgScore10: row.avg_score_10 || 0,
          avgEliminations10: row.avg_eliminations_10 || 0,
          avgDeposits10: row.avg_deposits_10 || 0,
          avgWartDistance10: row.avg_wart_distance_10 || 0,

          avgWinRate20: row.avg_win_rate_20 || 0,
          avgScore20: row.avg_score_20 || 0,
          avgEliminations20: row.avg_eliminations_20 || 0,
          avgDeposits20: row.avg_deposits_20 || 0,
          avgWartDistance20: row.avg_wart_distance_20 || 0,

          avgWinRate30: row.avg_win_rate_30 || 0,
          avgScore30: row.avg_score_30 || 0,
          avgEliminations30: row.avg_eliminations_30 || 0,
          avgDeposits30: row.avg_deposits_30 || 0,
          avgWartDistance30: row.avg_wart_distance_30 || 0,
        };
      }
    }

    // 3. Build the response map
    const statsMap: Record<string, any> = {};

    for (const row of globalData) {
      if (row.name) {
        const upperName = row.name.toUpperCase();
        const avgs = averagesByName[upperName] || {};

        statsMap[upperName] = {
          name: row.name,
          class: row.class || '',
          stars: row.stars || 0,
          eliminations: row.eliminations,
          deposits: row.deposits,
          wartDistance: row.wart_distance,
          score: row.score,
          winRate: row.win_rate,
          avgEliminations: avgs.avgEliminations10 || 0,
          avgDeposits: avgs.avgDeposits10 || 0,
          avgWartDistance: avgs.avgWartDistance10 || 0,
          avgScore: avgs.avgScore10 || 0,
          avgWinRate: avgs.avgWinRate10 || 0,

          avgEliminations10: avgs.avgEliminations10 || 0,
          avgDeposits10: avgs.avgDeposits10 || 0,
          avgWartDistance10: avgs.avgWartDistance10 || 0,
          avgScore10: avgs.avgScore10 || 0,
          avgWinRate10: avgs.avgWinRate10 || 0,

          avgEliminations20: avgs.avgEliminations20 || 0,
          avgDeposits20: avgs.avgDeposits20 || 0,
          avgWartDistance20: avgs.avgWartDistance20 || 0,
          avgScore20: avgs.avgScore20 || 0,
          avgWinRate20: avgs.avgWinRate20 || 0,

          avgEliminations30: avgs.avgEliminations30 || 0,
          avgDeposits30: avgs.avgDeposits30 || 0,
          avgWartDistance30: avgs.avgWartDistance30 || 0,
          avgScore30: avgs.avgScore30 || 0,
          avgWinRate30: avgs.avgWinRate30 || 0,
          defense: row.defense,
          dexterity: row.dexterity,
          fortitude: row.fortitude,
          speed: row.speed,
          strength: row.strength,
          totalStats: row.total_stats,
          train: row.train,
        };
      }
    }

    return NextResponse.json(statsMap, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('[API Stats] DB Error:', error);
    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    );
  }
}
