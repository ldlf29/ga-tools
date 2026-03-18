-- =====================================================
-- PASO 1: Eliminar TODAS las versiones viejas de las funciones
-- =====================================================
DROP FUNCTION IF EXISTS public.get_moki_match_averages();
DROP FUNCTION IF EXISTS public.get_moki_match_averages(integer);
DROP FUNCTION IF EXISTS public.cleanup_old_matches();
DROP FUNCTION IF EXISTS public.cleanup_old_matches(integer);

-- =====================================================
-- PASO 2: Crear cleanup_old_matches (mantiene las últimas N partidas)
-- =====================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_matches(keep_count integer DEFAULT 40)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
    deleted_count integer := 0;
BEGIN
    WITH matches_to_delete AS (
        SELECT id
        FROM (
            SELECT
                id,
                ROW_NUMBER() OVER (PARTITION BY moki_id ORDER BY match_date DESC, created_at DESC) as row_num
            FROM public.moki_match_history
        ) ranked
        WHERE row_num > keep_count
    )
    DELETE FROM public.moki_match_history
    WHERE id IN (SELECT id FROM matches_to_delete);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$function$;

-- =====================================================
-- PASO 3: Crear get_moki_match_averages (calcula promedios Last 10/20/30)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_moki_match_averages()
 RETURNS TABLE(
    moki_name text, 
    avg_eliminations_10 numeric, 
    avg_deposits_10 numeric, 
    avg_wart_distance_10 numeric, 
    avg_score_10 numeric, 
    avg_win_rate_10 numeric,
    avg_eliminations_20 numeric, 
    avg_deposits_20 numeric, 
    avg_wart_distance_20 numeric, 
    avg_score_20 numeric, 
    avg_win_rate_20 numeric,
    avg_eliminations_30 numeric, 
    avg_deposits_30 numeric, 
    avg_wart_distance_30 numeric, 
    avg_score_30 numeric, 
    avg_win_rate_30 numeric
 )
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  WITH RankedMatches AS (
    SELECT 
      mh.moki_name::text AS mn,
      mh.eliminations,
      mh.deposits,
      mh.wart_distance,
      (CASE WHEN mh.team_won = mh.moki_team THEN 300 ELSE 0 END) +
      (COALESCE(mh.deposits, 0) * 50) +
      (COALESCE(mh.eliminations, 0) * 80) +
      (FLOOR(COALESCE(mh.wart_distance, 0) / 80) * 45) AS match_score,
      CASE WHEN mh.team_won = mh.moki_team THEN 1.0 ELSE 0.0 END AS is_win,
      ROW_NUMBER() OVER(PARTITION BY mh.moki_id ORDER BY mh.match_id DESC) as rn
    FROM public.moki_match_history mh
  )
  SELECT 
    rm.mn AS moki_name,
    -- LAST 10
    ROUND(AVG(rm.eliminations) FILTER (WHERE rm.rn <= 10), 2) AS avg_eliminations_10,
    ROUND(AVG(rm.deposits) FILTER (WHERE rm.rn <= 10), 2) AS avg_deposits_10,
    ROUND(AVG(rm.wart_distance) FILTER (WHERE rm.rn <= 10), 2) AS avg_wart_distance_10,
    ROUND(AVG(rm.match_score) FILTER (WHERE rm.rn <= 10), 2) AS avg_score_10,
    ROUND(AVG(rm.is_win) FILTER (WHERE rm.rn <= 10) * 100, 2) AS avg_win_rate_10,
    
    -- LAST 20
    ROUND(AVG(rm.eliminations) FILTER (WHERE rm.rn <= 20), 2) AS avg_eliminations_20,
    ROUND(AVG(rm.deposits) FILTER (WHERE rm.rn <= 20), 2) AS avg_deposits_20,
    ROUND(AVG(rm.wart_distance) FILTER (WHERE rm.rn <= 20), 2) AS avg_wart_distance_20,
    ROUND(AVG(rm.match_score) FILTER (WHERE rm.rn <= 20), 2) AS avg_score_20,
    ROUND(AVG(rm.is_win) FILTER (WHERE rm.rn <= 20) * 100, 2) AS avg_win_rate_20,
    
    -- LAST 30
    ROUND(AVG(rm.eliminations) FILTER (WHERE rm.rn <= 30), 2) AS avg_eliminations_30,
    ROUND(AVG(rm.deposits) FILTER (WHERE rm.rn <= 30), 2) AS avg_deposits_30,
    ROUND(AVG(rm.wart_distance) FILTER (WHERE rm.rn <= 30), 2) AS avg_wart_distance_30,
    ROUND(AVG(rm.match_score) FILTER (WHERE rm.rn <= 30), 2) AS avg_score_30,
    ROUND(AVG(rm.is_win) FILTER (WHERE rm.rn <= 30) * 100, 2) AS avg_win_rate_30
  FROM RankedMatches rm
  GROUP BY rm.mn;
END;
$function$;
