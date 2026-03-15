-- ==========================================================
-- FUNCTION: update_daily_leaderboard
-- Aggregates scores from `moki_match_history` for a given date 
-- and upserts calculations into `daily_leaderboard`.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.update_daily_leaderboard(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
    -- 1. Insert or Upsert aggregated scores from moki_match_history
    WITH scored_matches AS (
        SELECT 
            token_id::TEXT as moki_id,
            match_date::DATE as date,
            -- Formula: (is_winner * 300) + (deposits * 50) + (eliminations * 80) + (floor(wart_distance / 80) * 45)
            SUM(
                (CASE WHEN is_winner THEN 300 ELSE 0 END) +
                (COALESCE(deposits, 0) * 50) +
                (COALESCE(eliminations, 0) * 80) +
                (FLOOR(COALESCE(wart_distance, 0) / 80.0) * 45)
            )::INTEGER as calculated_score
        FROM public.moki_match_history
        WHERE match_date::DATE = target_date
        GROUP BY token_id, match_date::DATE
    ),
    ranked_matches AS (
        SELECT 
            moki_id,
            date,
            calculated_score,
            RANK() OVER (ORDER BY calculated_score DESC)::INTEGER as computed_rank
        FROM scored_matches
    )
    INSERT INTO public.daily_leaderboard (moki_id, date, daily_score, daily_rank)
    SELECT 
        moki_id,
        date,
        calculated_score,
        computed_rank
    FROM ranked_matches
    ON CONFLICT (moki_id, date) 
    DO UPDATE SET 
        daily_score = EXCLUDED.daily_score,
        daily_rank = EXCLUDED.daily_rank,
        created_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Usage Example:
-- SELECT public.update_daily_leaderboard('2026-03-14');
-- Or for today:
-- SELECT public.update_daily_leaderboard();
