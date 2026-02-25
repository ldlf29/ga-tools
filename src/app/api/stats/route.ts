import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Revalidate every 10 minutes (600s) to sync smoothly with the new Cron endpoints
export const revalidate = 600;

export async function GET() {
    try {
        // console.log("[API Stats] Fetching from Supabase moki_stats...");

        // 1. Fetch all Moki stats from the new minimal table
        const { data: globalData, error: globalError } = await supabase
            .from('moki_stats')
            .select('*');

        if (globalError) {
            throw globalError;
        }

        if (!globalData) {
            return NextResponse.json({});
        }

        // 2. Fetch match history to calculate 10-match averages
        const { data: matchData, error: matchError } = await supabase
            .from('moki_match_history')
            .select('moki_name, eliminations, deposits, wart_distance, team_won, moki_team, created_at')
            .order('created_at', { ascending: false });

        if (matchError) {
            console.warn("[API Stats] Failed to fetch match history:", matchError);
        }

        // Group matches by moki_name and keep latest 10
        const mokiMatchesMap = new Map<string, any[]>();
        if (matchData) {
            for (const row of matchData) {
                if (!row.moki_name) continue;
                const key = row.moki_name.toUpperCase();
                if (!mokiMatchesMap.has(key)) {
                    mokiMatchesMap.set(key, []);
                }
                const matches = mokiMatchesMap.get(key)!;
                if (matches.length < 10) {
                    matches.push(row);
                }
            }
        }

        // Calculate averages
        const averagesByName: Record<string, any> = {};
        for (const [name, matches] of mokiMatchesMap.entries()) {
            let wins = 0, totalElims = 0, totalDeposits = 0, totalWart = 0, totalScore = 0;
            matches.forEach(m => {
                const isWinner = m.team_won === m.moki_team;
                if (isWinner) wins++;
                totalElims += m.eliminations || 0;
                totalDeposits += m.deposits || 0;
                totalWart += m.wart_distance || 0;
                totalScore += (isWinner ? 300 : 0) + ((m.deposits || 0) * 50) + ((m.eliminations || 0) * 80) + (Math.floor((m.wart_distance || 0) / 80) * 45);
            });
            const numMatches = matches.length;
            averagesByName[name] = {
                avgWinRate: numMatches > 0 ? (wins / numMatches) * 100 : 0,
                avgScore: numMatches > 0 ? totalScore / numMatches : 0,
                avgEliminations: numMatches > 0 ? totalElims / numMatches : 0,
                avgDeposits: numMatches > 0 ? totalDeposits / numMatches : 0,
                avgWartDistance: numMatches > 0 ? totalWart / numMatches : 0,
            };
        }

        // Transform into the expected Map format: { "NAME": { ...stats } }
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

        // console.log(`[API Stats] Returned ${Object.keys(statsMap).length} records from moki_stats.`);

        return NextResponse.json(statsMap);

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Database error';
        console.error("[API Stats] DB Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
