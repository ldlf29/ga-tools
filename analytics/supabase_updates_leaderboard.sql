-- Create table for the daily historical ranking
CREATE TABLE IF NOT EXISTS public.daily_leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moki_id TEXT NOT NULL,
    date DATE NOT NULL,
    daily_score INTEGER NOT NULL DEFAULT 0,
    daily_rank INTEGER NOT NULL DEFAULT 180,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning fast time series charting
CREATE INDEX IF NOT EXISTS idx_leaderboard_moki ON public.daily_leaderboard (moki_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_date ON public.daily_leaderboard (date);
-- Useful compound index for "Top 10 on Date X" or "Moki Y over Time Z"
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_moki_date ON public.daily_leaderboard (moki_id, date);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- 1. Enable RLS on the table
ALTER TABLE public.daily_leaderboard ENABLE ROW LEVEL SECURITY;

-- 2. Allow PUBLIC READ access (for Anon or Authenticated users/Frontend)
CREATE POLICY "Allow public read access" 
ON public.daily_leaderboard
FOR SELECT 
TO anon, authenticated
USING (true);

-- 3. Allow SERVICE ROLE to perform all actions (for our Python backend upload)
CREATE POLICY "Allow service role full access" 
ON public.daily_leaderboard
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);
