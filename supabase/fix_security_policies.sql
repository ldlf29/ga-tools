-- =============================================================
-- S3 FIX: Supabase Security Policies & Cleanup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- ─────────────────────────────────────────────
-- 1. FIX: moki_stats — restrict write to service_role only
-- ─────────────────────────────────────────────
-- Drop the overly permissive policy (allows ANY user to write)
DROP POLICY IF EXISTS "Allow service role upsert" ON moki_stats;

-- Create a restricted policy: only service_role can insert/update/delete
CREATE POLICY "Service role write access" ON moki_stats
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- The read policy "Allow public read access" (FOR SELECT USING true) stays — it's correct.

-- ─────────────────────────────────────────────
-- 2. FIX: class_changes — restrict write to service_role only
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow service role insert" ON class_changes;

CREATE POLICY "Service role write access" ON class_changes
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- 3. FIX: sync_logs — add missing RLS policies
-- ─────────────────────────────────────────────
-- sync_logs is write-only by cron jobs, nobody reads publicly
-- Only service_role should read and write
CREATE POLICY "Service role full access" ON sync_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- 4. FIX: moki_match_history — ensure proper RLS
-- ─────────────────────────────────────────────
-- Public can read (for the match history modal), only service_role writes
-- Check if RLS is enabled first
ALTER TABLE moki_match_history ENABLE ROW LEVEL SECURITY;

-- Allow public read (for MatchHistoryModal.tsx)
DROP POLICY IF EXISTS "Allow public read" ON moki_match_history;
CREATE POLICY "Allow public read" ON moki_match_history
    FOR SELECT USING (true);

-- Only service_role writes (cron sync-matches)
DROP POLICY IF EXISTS "Service role write access" ON moki_match_history;
CREATE POLICY "Service role write access" ON moki_match_history
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ─────────────────────────────────────────────
-- 5. FIX: update_modified_column — set search_path
-- ─────────────────────────────────────────────
-- This fixes Supabase warning about mutable search_path
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────
-- 6. CLEANUP: Drop unused global_nft_cache table
-- ─────────────────────────────────────────────
DROP TABLE IF EXISTS global_nft_cache;

-- ─────────────────────────────────────────────
-- 7. NEW: Database function for match history cleanup
--    Called by sync-matches cron via supabaseAdmin.rpc('cleanup_old_matches')
--    Replaces the old JavaScript-based cleanup that fetched ALL rows into memory.
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_old_matches(keep_count INTEGER DEFAULT 20)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY moki_id
                   ORDER BY created_at DESC
               ) AS rn
        FROM moki_match_history
    ),
    to_delete AS (
        DELETE FROM moki_match_history
        WHERE id IN (SELECT id FROM ranked WHERE rn > keep_count)
        RETURNING 1
    )
    SELECT COUNT(*) INTO deleted_count FROM to_delete;

    RETURN deleted_count;
END;
$$;
