-- Create table to store class change history
CREATE TABLE IF NOT EXISTS class_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    moki_name TEXT NOT NULL,
    old_class TEXT NOT NULL,
    new_class TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    image_url TEXT
);

-- Create index for faster queries by date
CREATE INDEX IF NOT EXISTS idx_class_changes_date ON class_changes (changed_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE class_changes ENABLE ROW LEVEL SECURITY;

-- Allow public read access (if you want the changelog to be publicly visible)
CREATE POLICY "Allow public read access" ON class_changes
    FOR SELECT USING (true);

-- Allow service role to insert (for the sync script)
CREATE POLICY "Allow service role insert" ON class_changes
    FOR INSERT WITH CHECK (true);
