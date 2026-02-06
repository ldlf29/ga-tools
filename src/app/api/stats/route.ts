import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Revalidate every 1 hour (3600s)
export const revalidate = 3600;

export async function GET() {
    try {
        console.log("[API Stats] Fetching from Supabase moki_stats...");

        // Fetch all Moki stats from the new minimal table
        const { data, error } = await supabase
            .from('moki_stats')
            .select('*');

        if (error) {
            throw error;
        }

        if (!data) {
            return NextResponse.json({});
        }

        // Transform into the expected Map format: { "NAME": { ...stats } }
        const statsMap: Record<string, any> = {};

        for (const row of data) {
            if (row.name) {
                statsMap[row.name.toUpperCase()] = {
                    name: row.name,
                    class: row.class || "",
                    stars: row.stars || 0,
                    eliminations: row.eliminations,
                    deposits: row.deposits,
                    wartDistance: row.wart_distance,
                    score: row.score,
                    winRate: row.win_rate,
                    defense: row.defense,
                    dexterity: row.dexterity,
                    fortitude: row.fortitude,
                    speed: row.speed,
                    strength: row.strength,
                    totalStats: row.total_stats
                };
            }
        }

        console.log(`[API Stats] Returned ${Object.keys(statsMap).length} records from moki_stats.`);

        return NextResponse.json(statsMap);

    } catch (error: any) {
        console.error("[API Stats] DB Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
