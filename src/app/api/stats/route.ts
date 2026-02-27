import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Revalidate every 10 minutes (600s) to sync smoothly with the new Cron endpoints
export const revalidate = 600;

export async function GET() {
    console.log("[API Stats] Loading data...");
    try {
        // 1. Fetch all Moki stats
        const { data: globalData, error: globalError } = await supabaseAdmin
            .from('moki_stats')
            .select('*');

        if (globalError) {
            console.error("[API Stats] Moki stats fetch error:", globalError);
            throw globalError;
        }

        if (!globalData) {
            return NextResponse.json({});
        }

        // 2. Fetch last-10-match averages via SQL function (avoids full-table scan)
        const averagesByName: Record<string, any> = {};
        const { data: avgData, error: avgError } = await supabaseAdmin
            .rpc('get_moki_match_averages', { match_limit: 10 });

        if (avgError) {
            console.warn("[API Stats] Failed to fetch match averages (Function might not exist yet):", avgError);
        } else if (avgData) {
            console.log(`[API Stats] Fetched averages for ${avgData.length} Mokis`);
            for (const row of avgData) {
                averagesByName[row.moki_name] = {
                    avgWinRate: row.avg_win_rate || 0,
                    avgScore: row.avg_score || 0,
                    avgEliminations: row.avg_eliminations || 0,
                    avgDeposits: row.avg_deposits || 0,
                    avgWartDistance: row.avg_wart_distance || 0,
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
                    class: row.class || "",
                    stars: row.stars || 0,
                    eliminations: row.eliminations,
                    deposits: row.deposits,
                    wartDistance: row.wart_distance,
                    score: row.score,
                    winRate: row.win_rate,
                    avgEliminations: avgs.avgEliminations || 0,
                    avgDeposits: avgs.avgDeposits || 0,
                    avgWartDistance: avgs.avgWartDistance || 0,
                    avgScore: avgs.avgScore || 0,
                    avgWinRate: avgs.avgWinRate || 0,
                    defense: row.defense,
                    dexterity: row.dexterity,
                    fortitude: row.fortitude,
                    speed: row.speed,
                    strength: row.strength,
                    totalStats: row.total_stats,
                    train: row.train
                };
            }
        }

        return NextResponse.json(statsMap, {
            headers: {
                'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300'
            }
        });

    } catch (error) {
        console.error("[API Stats] DB Error:", error);
        return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 });
    }
}
