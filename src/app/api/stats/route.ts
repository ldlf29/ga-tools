/* eslint-disable @typescript-eslint/no-explicit-any */
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
      .select('*')
      .limit(500); // Cap at 500 rows; the moki roster never exceeds this

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
          avgEndedGame10: row.avg_ended_game_10 || 0,
          avgDeaths10: row.avg_deaths_10 || 0,
          avgEatingWhileRiding10: row.avg_eating_while_riding_10 || 0,
          avgBuffTime10: row.avg_buff_time_10 || 0,
          avgWartTime10: row.avg_wart_time_10 || 0,
          avgLooseBallPickups10: row.avg_loose_ball_pickups_10 || 0,
          avgEatenByWart10: row.avg_eaten_by_wart_10 || 0,
          avgWartCloser10: row.avg_wart_closer_10 || 0,
          avgEndedGame20: row.avg_ended_game_20 || 0,
          avgDeaths20: row.avg_deaths_20 || 0,
          avgEatingWhileRiding20: row.avg_eating_while_riding_20 || 0,
          avgBuffTime20: row.avg_buff_time_20 || 0,
          avgWartTime20: row.avg_wart_time_20 || 0,
          avgLooseBallPickups20: row.avg_loose_ball_pickups_20 || 0,
          avgEatenByWart20: row.avg_eaten_by_wart_20 || 0,
          avgWartCloser20: row.avg_wart_closer_20 || 0,
          avgEndedGame30: row.avg_ended_game_30 || 0,
          avgDeaths30: row.avg_deaths_30 || 0,
          avgEatingWhileRiding30: row.avg_eating_while_riding_30 || 0,
          avgBuffTime30: row.avg_buff_time_30 || 0,
          avgWartTime30: row.avg_wart_time_30 || 0,
          avgLooseBallPickups30: row.avg_loose_ball_pickups_30 || 0,
          avgEatenByWart30: row.avg_eaten_by_wart_30 || 0,
          avgWartCloser30: row.avg_wart_closer_30 || 0,
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
          avgEndedGame10: avgs.avgEndedGame10 || 0,
          avgDeaths10: avgs.avgDeaths10 || 0,
          avgEatingWhileRiding10: avgs.avgEatingWhileRiding10 || 0,
          avgBuffTime10: avgs.avgBuffTime10 || 0,
          avgWartTime10: avgs.avgWartTime10 || 0,
          avgLooseBallPickups10: avgs.avgLooseBallPickups10 || 0,
          avgEatenByWart10: avgs.avgEatenByWart10 || 0,
          avgWartCloser10: avgs.avgWartCloser10 || 0,
          avgEndedGame20: avgs.avgEndedGame20 || 0,
          avgDeaths20: avgs.avgDeaths20 || 0,
          avgEatingWhileRiding20: avgs.avgEatingWhileRiding20 || 0,
          avgBuffTime20: avgs.avgBuffTime20 || 0,
          avgWartTime20: avgs.avgWartTime20 || 0,
          avgLooseBallPickups20: avgs.avgLooseBallPickups20 || 0,
          avgEatenByWart20: avgs.avgEatenByWart20 || 0,
          avgWartCloser20: avgs.avgWartCloser20 || 0,
          avgEndedGame30: avgs.avgEndedGame30 || 0,
          avgDeaths30: avgs.avgDeaths30 || 0,
          avgEatingWhileRiding30: avgs.avgEatingWhileRiding30 || 0,
          avgBuffTime30: avgs.avgBuffTime30 || 0,
          avgWartTime30: avgs.avgWartTime30 || 0,
          avgLooseBallPickups30: avgs.avgLooseBallPickups30 || 0,
          avgEatenByWart30: avgs.avgEatenByWart30 || 0,
          avgWartCloser30: avgs.avgWartCloser30 || 0,
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
