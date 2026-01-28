import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Revalidate every 1 hour (3600s) instead of 12h, since DB is faster/cheaper to query
export const revalidate = 3600;

export async function GET() {
    try {
        console.log("[API Stats] Fetching from Supabase...");

        // Fetch all cards that have stats
        // We only want the 'stats' column to mimic the previous CSV-to-JSON behavior
        const { data, error } = await supabase
            .from('cards')
            .select('stats')
            .not('stats', 'is', null);

        if (error) {
            throw error;
        }

        if (!data) {
            return NextResponse.json({});
        }

        // Transform into the expected Map format: { "NAME": { ...stats } }
        const statsMap: Record<string, any> = {};

        for (const row of data) {
            const stats = row.stats as any;
            if (stats && stats.name) {
                statsMap[stats.name.toUpperCase()] = stats;
            }
        }

        console.log(`[API Stats] Returned ${Object.keys(statsMap).length} records from DB.`);

        return NextResponse.json(statsMap);

    } catch (error: any) {
        console.error("[API Stats] DB Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
