-- Create a new table to store upcoming scheduled matches
CREATE TABLE IF NOT EXISTS upcoming_matches (
    id TEXT PRIMARY KEY, -- Using the string ID from the API (e.g. "69a3bad7de01aed508e38ece")
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    team1_name TEXT NOT NULL,
    team2_name TEXT NOT NULL,
    team1_mokis JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of image URLs
    team2_mokis JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of image URLs
    user_mokis JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { id, imageUrl } objects
    target_moki_name TEXT NOT NULL, -- The name of the Moki this match was fetched for (to link to moki_stats)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: Since the same match might appear under multiple Mokis' schedules, 
-- we use the API match ID as the primary key. If the same match ID is fetched again,
-- we can UPSERT it to update the target_moki_name or just ignore it if it exists.

-- Enable Row Level Security
ALTER TABLE public.upcoming_matches ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow anyone to read the upcoming matches
CREATE POLICY "Allow public read access" ON public.upcoming_matches
    FOR SELECT
    USING (true);
