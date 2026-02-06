-- Create new minimal stats table (only dynamic data from Google Sheets)
CREATE TABLE IF NOT EXISTS moki_stats (
    name TEXT PRIMARY KEY,
    class TEXT,
    stars INTEGER DEFAULT 0,
    eliminations DECIMAL DEFAULT 0,
    deposits DECIMAL DEFAULT 0,
    wart_distance DECIMAL DEFAULT 0,
    score DECIMAL DEFAULT 0,
    win_rate DECIMAL DEFAULT 0,
    defense DECIMAL DEFAULT 0,
    dexterity DECIMAL DEFAULT 0,
    fortitude DECIMAL DEFAULT 0,
    speed DECIMAL DEFAULT 0,
    strength DECIMAL DEFAULT 0,
    total_stats DECIMAL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_moki_stats_class ON moki_stats (class);

-- Enable Row Level Security
ALTER TABLE moki_stats ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON moki_stats
    FOR SELECT USING (true);

-- Allow service role to insert/update (for sync script)
CREATE POLICY "Allow service role upsert" ON moki_stats
    FOR ALL USING (true) WITH CHECK (true);
