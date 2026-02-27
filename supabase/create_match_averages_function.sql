-- =============================================================
-- P4 FIX: Compute match averages on the database side
-- Run this in the Supabase SQL Editor
-- =============================================================

-- Create a function that returns last-N-match averages per moki
-- This replaces fetching ALL rows into Node.js memory
CREATE OR REPLACE FUNCTION public.get_moki_match_averages(match_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    moki_name TEXT,
    avg_win_rate NUMERIC,
    avg_score NUMERIC,
    avg_eliminations NUMERIC,
    avg_deposits NUMERIC,
    avg_wart_distance NUMERIC
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_matches AS (
        SELECT
            m.moki_name,
            m.eliminations,
            m.deposits,
            m.wart_distance,
            m.team_won,
            m.moki_team,
            ROW_NUMBER() OVER (
                PARTITION BY UPPER(m.moki_name)
                ORDER BY m.created_at DESC
            ) AS rn
        FROM moki_match_history m
    ),
    last_n AS (
        SELECT * FROM ranked_matches WHERE rn <= match_limit
    )
    SELECT
        UPPER(ln.moki_name) AS moki_name,
        ROUND(
            (COUNT(*) FILTER (WHERE ln.team_won = ln.moki_team))::NUMERIC
            / GREATEST(COUNT(*), 1) * 100, 2
        ) AS avg_win_rate,
        ROUND(
            AVG(
                (CASE WHEN ln.team_won = ln.moki_team THEN 300 ELSE 0 END)
                + (COALESCE(ln.deposits, 0) * 50)
                + (COALESCE(ln.eliminations, 0) * 80)
                + (FLOOR(COALESCE(ln.wart_distance, 0) / 80) * 45)
            ), 2
        ) AS avg_score,
        ROUND(AVG(COALESCE(ln.eliminations, 0)), 2) AS avg_eliminations,
        ROUND(AVG(COALESCE(ln.deposits, 0)), 2) AS avg_deposits,
        ROUND(AVG(COALESCE(ln.wart_distance, 0)), 2) AS avg_wart_distance
    FROM last_n ln
    GROUP BY UPPER(ln.moki_name);
END;
$$;
