import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fetch } from 'undici';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase Credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const STATS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQAcXVDO4ylx4jU6KEjceneqnNYRyL6MB3R0myZE5bF1_Th8q4F79eUZsPZ-93pojf6UxUE1OiAGZEC/pub?output=csv";

interface MokiStats {
    name: string;
    class: string;
    stars: number;
    eliminations: number;
    deposits: number;
    wart_distance: number;
    score: number;
    win_rate: number;
    defense: number;
    dexterity: number;
    fortitude: number;
    speed: number;
    strength: number;
    total_stats: number;
}

async function main() {
    console.log("🚀 Starting Synchronization Job...");
    const startTime = Date.now();

    try {
        // 1. Fetch Google Sheets CSV
        console.log("📥 Fetching Stats from Google Sheets...");
        const response = await fetch(STATS_URL);
        if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
        const csvText = await response.text();
        const statsRecords = parseStatsCSV(csvText);
        console.log(`✅ Loaded stats for ${statsRecords.length} Mokis.`);

        // 2. Detect Class Changes BEFORE Upsert
        console.log("🔍 Checking for class changes...");

        const { data: existingStats, error: fetchError } = await supabase
            .from('moki_stats')
            .select('name, class');

        if (fetchError) {
            console.error("⚠️ Could not fetch existing stats for changelog:", fetchError.message);
        }

        const existingClassMap: Record<string, string> = {};
        if (existingStats) {
            for (const stat of existingStats) {
                existingClassMap[stat.name.toUpperCase()] = stat.class || "";
            }
        }

        // Compare and log class changes
        const classChanges: { moki_name: string, old_class: string, new_class: string, image_url: string }[] = [];
        const loggedMokis = new Set<string>();

        for (const stat of statsRecords) {
            const normalizedName = stat.name.toUpperCase();
            if (loggedMokis.has(normalizedName)) continue;

            const existingClass = existingClassMap[normalizedName];
            const newClass = stat.class;

            if (existingClass && newClass && existingClass !== newClass) {
                console.log(`📝 Class change detected: ${stat.name} (${existingClass} → ${newClass})`);
                classChanges.push({
                    moki_name: stat.name,
                    old_class: existingClass,
                    new_class: newClass,
                    image_url: "" // We don't store images in DB anymore
                });
                loggedMokis.add(normalizedName);
            }
        }

        // Insert class changes into the changelog table (avoiding duplicates)
        if (classChanges.length > 0) {
            const mokiNames = classChanges.map(c => c.moki_name);
            const { data: existingChanges } = await supabase
                .from('class_changes')
                .select('moki_name, new_class')
                .in('moki_name', mokiNames)
                .order('changed_at', { ascending: false });

            const mostRecentClass = new Map<string, string>();
            if (existingChanges) {
                for (const change of existingChanges) {
                    if (!mostRecentClass.has(change.moki_name)) {
                        mostRecentClass.set(change.moki_name, change.new_class);
                    }
                }
            }

            const newChanges = classChanges.filter(c => {
                const lastLoggedClass = mostRecentClass.get(c.moki_name);
                return !lastLoggedClass || lastLoggedClass !== c.new_class;
            });

            if (newChanges.length > 0) {
                const { error: changelogError } = await supabase.from('class_changes').insert(newChanges);
                if (changelogError) {
                    console.error("⚠️ Failed to log class changes:", changelogError.message);
                } else {
                    console.log(`✅ Logged ${newChanges.length} class change(s) to changelog.`);
                }
            } else {
                console.log("✅ Class changes already logged (no new entries).");
            }
        } else {
            console.log("✅ No class changes detected.");
        }

        // 3. Batch Upsert to moki_stats table
        console.log("📤 Upserting stats to moki_stats table...");
        const CHUNK_SIZE = 100;
        let successCount = 0;

        for (let i = 0; i < statsRecords.length; i += CHUNK_SIZE) {
            const chunk = statsRecords.slice(i, i + CHUNK_SIZE);
            const { error } = await supabase.from('moki_stats').upsert(chunk, { onConflict: 'name' });

            if (error) {
                console.error(`❌ Error upserting chunk ${i}-${i + CHUNK_SIZE}:`, error);
                throw error;
            }
            successCount += chunk.length;
            process.stdout.write(`.`);
        }
        console.log("\n");

        // 4. Log Success
        await supabase.from('sync_logs').insert({
            status: 'SUCCESS',
            cards_updated: successCount,
            details: `Synced ${successCount} Moki stats in ${(Date.now() - startTime)}ms`
        });

        console.log(`🎉 Sync Complete! Updated ${successCount} Moki stats.`);
        process.exit(0);

    } catch (error: any) {
        console.error("\n💥 Sync Failed:", error);

        try {
            await supabase.from('sync_logs').insert({
                status: 'ERROR',
                cards_updated: 0,
                details: error.message
            });
        } catch (logError) {
            console.error("Failed to log error to DB:", logError);
        }

        process.exit(1);
    }
}

// --- Helpers ---

function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                cur += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
    }
    result.push(cur);
    return result;
}

function parseStatsCSV(csvText: string): MokiStats[] {
    const lines = csvText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const statsRecords: MokiStats[] = [];
    const seenNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || ''; });

        const name = row['name'] || '';
        if (!name || seenNames.has(name.toUpperCase())) continue;
        seenNames.add(name.toUpperCase());

        // Helper to clean commas from numbers (e.g., "1,234" -> 1234)
        const parseNum = (val: string | undefined): number => {
            if (!val) return 0;
            const cleaned = val.replace(/,/g, '').trim();
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        };

        statsRecords.push({
            name: name,
            class: row['class'] || '',
            stars: parseInt((row['stars'] || '0').replace(/,/g, ''), 10) || 0,
            eliminations: parseNum(row['eliminations']),
            deposits: parseNum(row['deposits']),
            wart_distance: parseNum(row['wart distance'] || row['wartdistance']),
            score: parseNum(row['score']),
            win_rate: parseNum(row['win rate'] || row['winrate']),
            defense: parseNum(row['defense']),
            dexterity: parseNum(row['dexterity']),
            fortitude: parseNum(row['fortitude']),
            speed: parseNum(row['speed']),
            strength: parseNum(row['strength']),
            total_stats: parseNum(row['total stats'] || row['totalstats'] || row['total'])
        });
    }

    return statsRecords;
}

main();
