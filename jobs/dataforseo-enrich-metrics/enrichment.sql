-- ============================================================================
-- DataForSEO K4K Metrics Enrichment
-- ============================================================================
--
-- Enriches keywords populated by DataForSEO K4K with normalized metrics
-- derived from extras.monthly_trend and extras.dataforseo.competition.
--
-- Computes:
-- - base_demand_index: ln(1+avg_12m) / ln(1+p99_avg) in [0,1]
-- - competition_score: from extras.dataforseo.competition
-- - engagement_score: 1 - competition_score
-- - trend_momentum: slope(series) / max_abs_slope_raw
-- - deseasoned_trend_momentum: slope(deseasoned) / max_abs_slope_des
-- - seasonal_label: '<Month>_peak' using month with max seasonal index
-- - adjusted_demand_index: base * (1 - competition) * (1 + deseasoned_tm)
-- - ai_opportunity_score: base * (1 - competition) * (0.5 + 0.5*engagement)
--
-- Usage:
--   SELECT enrich_dataforseo_k4k_metrics(
--     p_where_clause := 'id IN (...)',
--     p_limit := 10000,
--     p_dry_run := false
--   );
-- ============================================================================

CREATE OR REPLACE FUNCTION enrich_dataforseo_k4k_metrics(
  p_where_clause text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_dry_run boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sql text;
  v_result jsonb;
  v_start_ts timestamptz := clock_timestamp();
  v_end_ts timestamptz;
  v_processed_count integer := 0;
  v_updated_count integer := 0;
  v_p99_avg numeric;
  v_max_abs_slope_raw numeric;
  v_max_abs_slope_des numeric;
BEGIN
  -- Build the CTE-based enrichment query
  v_sql := $$
    WITH eligible AS (
      -- Select keywords with DataForSEO K4K data
      SELECT
        k.id,
        k.extras,
        -- Extract last 12 months from monthly_trend array
        (
          SELECT array_agg(
            (mt->>'searches')::numeric
            ORDER BY (mt->>'year')::int DESC, (mt->>'month')::int DESC
          )
          FROM jsonb_array_elements(k.extras->'monthly_trend') mt
          LIMIT 12
        ) AS monthly_series
      FROM public.keywords k
      WHERE k.method = 'dataforseo_k4k_standard'
        AND k.extras ? 'monthly_trend'
        AND jsonb_array_length(k.extras->'monthly_trend') > 0
    $$;

  -- Add optional WHERE clause
  IF p_where_clause IS NOT NULL AND p_where_clause <> '' THEN
    v_sql := v_sql || ' AND ' || p_where_clause;
  END IF;

  -- Add optional LIMIT
  IF p_limit IS NOT NULL THEN
    v_sql := v_sql || ' LIMIT ' || p_limit::text;
  END IF;

  v_sql := v_sql || $$
    ),

    with_avg AS (
      -- Compute 12-month average for each keyword
      SELECT
        e.id,
        e.extras,
        e.monthly_series,
        CASE
          WHEN e.monthly_series IS NOT NULL AND array_length(e.monthly_series, 1) > 0
          THEN (
            SELECT avg(val)
            FROM unnest(e.monthly_series) val
            WHERE val IS NOT NULL
          )
          ELSE 0
        END AS avg_12m
      FROM eligible e
    ),

    global_stats AS (
      -- Compute global normalizers
      SELECT
        percentile_cont(0.99) WITHIN GROUP (ORDER BY avg_12m) AS p99_avg
      FROM with_avg
      WHERE avg_12m > 0
    ),

    with_base_di AS (
      -- Compute base_demand_index
      SELECT
        wa.id,
        wa.extras,
        wa.monthly_series,
        wa.avg_12m,
        gs.p99_avg,
        CASE
          WHEN wa.avg_12m > 0 AND gs.p99_avg > 0
          THEN LEAST(1.0, GREATEST(0.0, ln(1 + wa.avg_12m) / ln(1 + gs.p99_avg)))
          ELSE 0.0
        END AS base_demand_index
      FROM with_avg wa
      CROSS JOIN global_stats gs
    ),

    with_competition AS (
      -- Extract competition_score from extras
      SELECT
        bd.id,
        bd.extras,
        bd.monthly_series,
        bd.avg_12m,
        bd.p99_avg,
        bd.base_demand_index,
        LEAST(1.0, GREATEST(0.0,
          COALESCE((bd.extras->'dataforseo'->>'competition')::numeric, 0.0)
        )) AS competition_score
      FROM with_base_di bd
    ),

    with_engagement AS (
      -- Compute engagement_score (placeholder: 1 - competition)
      SELECT
        wc.*,
        (1.0 - wc.competition_score) AS engagement_score
      FROM with_competition wc
    ),

    with_trend AS (
      -- Compute trend_momentum using linear regression slope
      SELECT
        we.id,
        we.extras,
        we.monthly_series,
        we.avg_12m,
        we.p99_avg,
        we.base_demand_index,
        we.competition_score,
        we.engagement_score,
        CASE
          WHEN we.monthly_series IS NOT NULL AND array_length(we.monthly_series, 1) >= 2
          THEN (
            -- Simple linear regression slope: (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
            WITH series_indexed AS (
              SELECT
                row_number() OVER () AS x,
                val AS y
              FROM unnest(we.monthly_series) val
            )
            SELECT
              (COUNT(*) * SUM(x * y) - SUM(x) * SUM(y)) /
              NULLIF(COUNT(*) * SUM(x * x) - SUM(x) * SUM(x), 0)
            FROM series_indexed
            WHERE y IS NOT NULL
          )
          ELSE 0.0
        END AS raw_slope
      FROM with_engagement we
    ),

    trend_stats AS (
      -- Compute max absolute slope for normalization
      SELECT
        GREATEST(0.0001, MAX(ABS(raw_slope))) AS max_abs_slope_raw
      FROM with_trend
    ),

    with_trend_normalized AS (
      -- Normalize trend_momentum
      SELECT
        wt.id,
        wt.extras,
        wt.monthly_series,
        wt.avg_12m,
        wt.p99_avg,
        wt.base_demand_index,
        wt.competition_score,
        wt.engagement_score,
        wt.raw_slope,
        ts.max_abs_slope_raw,
        CASE
          WHEN ts.max_abs_slope_raw > 0
          THEN LEAST(1.0, GREATEST(-1.0, wt.raw_slope / ts.max_abs_slope_raw))
          ELSE 0.0
        END AS trend_momentum
      FROM with_trend wt
      CROSS JOIN trend_stats ts
    ),

    with_seasonal AS (
      -- Compute seasonal indices and deseasonalize
      SELECT
        wtn.id,
        wtn.extras,
        wtn.monthly_series,
        wtn.avg_12m,
        wtn.p99_avg,
        wtn.base_demand_index,
        wtn.competition_score,
        wtn.engagement_score,
        wtn.raw_slope,
        wtn.max_abs_slope_raw,
        wtn.trend_momentum,
        -- Compute seasonal indices (series / avg)
        CASE
          WHEN wtn.monthly_series IS NOT NULL AND array_length(wtn.monthly_series, 1) > 0 AND wtn.avg_12m > 0
          THEN (
            SELECT array_agg(val / NULLIF(wtn.avg_12m, 0))
            FROM unnest(wtn.monthly_series) val
          )
          ELSE NULL
        END AS seasonal_indices,
        -- Deseasonalized series
        CASE
          WHEN wtn.monthly_series IS NOT NULL AND array_length(wtn.monthly_series, 1) > 0 AND wtn.avg_12m > 0
          THEN (
            SELECT array_agg(val / NULLIF(wtn.avg_12m, 0))
            FROM unnest(wtn.monthly_series) val
          )
          ELSE NULL
        END AS deseasoned_series
      FROM with_trend_normalized wtn
    ),

    with_seasonal_label AS (
      -- Find month with peak seasonal index
      SELECT
        ws.id,
        ws.extras,
        ws.monthly_series,
        ws.avg_12m,
        ws.p99_avg,
        ws.base_demand_index,
        ws.competition_score,
        ws.engagement_score,
        ws.raw_slope,
        ws.max_abs_slope_raw,
        ws.trend_momentum,
        ws.seasonal_indices,
        ws.deseasoned_series,
        CASE
          WHEN ws.seasonal_indices IS NOT NULL AND array_length(ws.seasonal_indices, 1) > 0
          THEN (
            WITH indexed AS (
              SELECT
                row_number() OVER () AS idx,
                val
              FROM unnest(ws.seasonal_indices) val
            ),
            max_idx AS (
              SELECT idx
              FROM indexed
              ORDER BY val DESC NULLS LAST
              LIMIT 1
            ),
            month_mapping AS (
              SELECT
                mi.idx,
                to_char(to_date((mi.idx)::text, 'MM'), 'Month') AS month_name
              FROM max_idx mi
            )
            SELECT TRIM(month_name) || '_peak'
            FROM month_mapping
          )
          ELSE NULL
        END AS seasonal_label
      FROM with_seasonal ws
    ),

    with_deseasoned_trend AS (
      -- Compute deseasoned trend momentum
      SELECT
        wsl.id,
        wsl.extras,
        wsl.base_demand_index,
        wsl.competition_score,
        wsl.engagement_score,
        wsl.trend_momentum,
        wsl.seasonal_label,
        wsl.max_abs_slope_raw,
        CASE
          WHEN wsl.deseasoned_series IS NOT NULL AND array_length(wsl.deseasoned_series, 1) >= 2
          THEN (
            WITH series_indexed AS (
              SELECT
                row_number() OVER () AS x,
                val AS y
              FROM unnest(wsl.deseasoned_series) val
            )
            SELECT
              (COUNT(*) * SUM(x * y) - SUM(x) * SUM(y)) /
              NULLIF(COUNT(*) * SUM(x * x) - SUM(x) * SUM(x), 0)
            FROM series_indexed
            WHERE y IS NOT NULL
          )
          ELSE 0.0
        END AS deseasoned_slope
      FROM with_seasonal_label wsl
    ),

    deseasoned_stats AS (
      -- Compute max absolute deseasoned slope
      SELECT
        GREATEST(0.0001, MAX(ABS(deseasoned_slope))) AS max_abs_slope_des
      FROM with_deseasoned_trend
    ),

    with_deseasoned_normalized AS (
      -- Normalize deseasoned trend momentum
      SELECT
        wdt.id,
        wdt.extras,
        wdt.base_demand_index,
        wdt.competition_score,
        wdt.engagement_score,
        wdt.trend_momentum,
        wdt.seasonal_label,
        wdt.max_abs_slope_raw,
        wdt.deseasoned_slope,
        ds.max_abs_slope_des,
        CASE
          WHEN ds.max_abs_slope_des > 0
          THEN LEAST(1.0, GREATEST(-1.0, wdt.deseasoned_slope / ds.max_abs_slope_des))
          ELSE 0.0
        END AS deseasoned_trend_momentum
      FROM with_deseasoned_trend wdt
      CROSS JOIN deseasoned_stats ds
    ),

    final_metrics AS (
      -- Compute final derived metrics
      SELECT
        wdn.id,
        wdn.base_demand_index,
        wdn.competition_score,
        wdn.engagement_score,
        wdn.trend_momentum,
        wdn.deseasoned_trend_momentum,
        wdn.seasonal_label,
        wdn.max_abs_slope_raw,
        wdn.max_abs_slope_des,
        -- adjusted_demand_index = base * (1 - competition) * (1 + deseasoned_tm)
        LEAST(1.0, GREATEST(0.0,
          wdn.base_demand_index * (1.0 - wdn.competition_score) * (1.0 + wdn.deseasoned_trend_momentum)
        )) AS adjusted_demand_index,
        -- ai_opportunity_score = base * (1 - competition) * (0.5 + 0.5*engagement)
        LEAST(1.0, GREATEST(0.0,
          wdn.base_demand_index * (1.0 - wdn.competition_score) * (0.5 + 0.5 * wdn.engagement_score)
        )) AS ai_opportunity_score,
        (SELECT p99_avg FROM global_stats) AS p99_avg
      FROM with_deseasoned_normalized wdn
    )

    $$;

  IF p_dry_run THEN
    -- Dry run: just return preview
    v_sql := v_sql || $$
      SELECT
        count(*) AS processed_count,
        0 AS updated_count,
        (SELECT p99_avg FROM global_stats LIMIT 1) AS p99_avg,
        (SELECT max_abs_slope_raw FROM final_metrics LIMIT 1) AS max_abs_slope_raw,
        (SELECT max_abs_slope_des FROM final_metrics LIMIT 1) AS max_abs_slope_des
      FROM final_metrics
    $$;

    EXECUTE v_sql INTO v_result;
    RETURN v_result || jsonb_build_object(
      'dry_run', true,
      'ms_elapsed', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_ts)) * 1000
    );
  ELSE
    -- Real run: UPDATE keywords
    v_sql := v_sql || $$
      UPDATE public.keywords k
      SET
        base_demand_index = fm.base_demand_index,
        competition_score = fm.competition_score,
        engagement_score = fm.engagement_score,
        trend_momentum = fm.trend_momentum,
        deseasoned_trend_momentum = fm.deseasoned_trend_momentum,
        seasonal_label = fm.seasonal_label,
        adjusted_demand_index = fm.adjusted_demand_index,
        ai_opportunity_score = fm.ai_opportunity_score,
        freshness_ts = now(),
        ingest_source = COALESCE(k.ingest_source, 'dataforseo'),
        ingest_metadata = COALESCE(k.ingest_metadata, '{}'::jsonb) || jsonb_build_object(
          'dfs_norm', jsonb_build_object(
            'p99_avg', fm.p99_avg,
            'max_abs_slope_raw', fm.max_abs_slope_raw,
            'max_abs_slope_des', fm.max_abs_slope_des,
            'enriched_at', now()
          )
        ),
        updated_at = now()
      FROM final_metrics fm
      WHERE k.id = fm.id
    $$;

    EXECUTE v_sql;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    v_end_ts := clock_timestamp();

    -- Get global stats for telemetry
    EXECUTE $$
      WITH eligible AS (
        SELECT k.id
        FROM public.keywords k
        WHERE k.method = 'dataforseo_k4k_standard'
          AND k.extras ? 'monthly_trend'
          AND jsonb_array_length(k.extras->'monthly_trend') > 0
      )
      SELECT count(*) FROM eligible
    $$ INTO v_processed_count;

    -- Get normalizers from updated rows
    SELECT
      (k.ingest_metadata->'dfs_norm'->>'p99_avg')::numeric,
      (k.ingest_metadata->'dfs_norm'->>'max_abs_slope_raw')::numeric,
      (k.ingest_metadata->'dfs_norm'->>'max_abs_slope_des')::numeric
    INTO v_p99_avg, v_max_abs_slope_raw, v_max_abs_slope_des
    FROM public.keywords k
    WHERE k.ingest_metadata ? 'dfs_norm'
    ORDER BY k.updated_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'dry_run', false,
      'processed_count', v_processed_count,
      'updated_count', v_updated_count,
      'ms_elapsed', EXTRACT(EPOCH FROM (v_end_ts - v_start_ts)) * 1000,
      'p99_avg', v_p99_avg,
      'max_abs_slope_raw', v_max_abs_slope_raw,
      'max_abs_slope_des', v_max_abs_slope_des
    );
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION enrich_dataforseo_k4k_metrics TO service_role, authenticated;
