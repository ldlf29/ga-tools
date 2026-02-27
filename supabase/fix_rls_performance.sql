-- =============================================================
-- RLS Performance Fix: Resolve all 16 Supabase Advisor Warnings
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================
-- 
-- Fixes two issues:
-- 1. auth.role() calls without (select ...) wrapper → re-evaluated per row
-- 2. FOR ALL policies overlapping with FOR SELECT policies → multiple permissive policies
--
-- Strategy:
--   - Public read: FOR SELECT USING (true)  — simple, no auth function needed
--   - Service role write: separate INSERT/UPDATE/DELETE policies with (select auth.role())
--   - sync_logs: service_role only for everything (no public read)
--

-- ─────────────────────────────────────────────
-- 1. moki_stats
-- ─────────────────────────────────────────────
-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read access" ON moki_stats;
DROP POLICY IF EXISTS "Service role write access" ON moki_stats;
DROP POLICY IF EXISTS "Allow service role upsert" ON moki_stats;

-- [SELECT] Anyone can read
CREATE POLICY "Public read" ON moki_stats
    FOR SELECT
    USING (true);

-- [INSERT/UPDATE/DELETE] Only service_role can write
CREATE POLICY "Service role write" ON moki_stats
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role update" ON moki_stats
    FOR UPDATE
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role delete" ON moki_stats
    FOR DELETE
    USING ((select auth.role()) = 'service_role');


-- ─────────────────────────────────────────────
-- 2. class_changes
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read access" ON class_changes;
DROP POLICY IF EXISTS "Service role write access" ON class_changes;
DROP POLICY IF EXISTS "Allow service role insert" ON class_changes;

-- [SELECT] Anyone can read (changelog)
CREATE POLICY "Public read" ON class_changes
    FOR SELECT
    USING (true);

-- [INSERT/UPDATE/DELETE] Only service_role
CREATE POLICY "Service role write" ON class_changes
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role update" ON class_changes
    FOR UPDATE
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role delete" ON class_changes
    FOR DELETE
    USING ((select auth.role()) = 'service_role');


-- ─────────────────────────────────────────────
-- 3. moki_match_history
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow public read" ON moki_match_history;
DROP POLICY IF EXISTS "Permitir lectura publica" ON moki_match_history;
DROP POLICY IF EXISTS "Service role write access" ON moki_match_history;

-- [SELECT] Anyone can read (match history modal)
CREATE POLICY "Public read" ON moki_match_history
    FOR SELECT
    USING (true);

-- [INSERT/UPDATE/DELETE] Only service_role
CREATE POLICY "Service role write" ON moki_match_history
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role update" ON moki_match_history
    FOR UPDATE
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

CREATE POLICY "Service role delete" ON moki_match_history
    FOR DELETE
    USING ((select auth.role()) = 'service_role');


-- ─────────────────────────────────────────────
-- 4. sync_logs (no public read — internal only)
-- ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON sync_logs;

-- [SELECT] Only service_role can read logs
CREATE POLICY "Service role read" ON sync_logs
    FOR SELECT
    USING ((select auth.role()) = 'service_role');

-- [INSERT] Only service_role can write logs
CREATE POLICY "Service role write" ON sync_logs
    FOR INSERT
    WITH CHECK ((select auth.role()) = 'service_role');

-- [UPDATE] Only service_role
CREATE POLICY "Service role update" ON sync_logs
    FOR UPDATE
    USING ((select auth.role()) = 'service_role')
    WITH CHECK ((select auth.role()) = 'service_role');

-- [DELETE] Only service_role
CREATE POLICY "Service role delete" ON sync_logs
    FOR DELETE
    USING ((select auth.role()) = 'service_role');
