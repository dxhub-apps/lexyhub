-- ============================================================================
-- DataForSEO K4K Metrics Enrichment - Test Fixtures
-- ============================================================================
--
-- Creates test keywords with controlled monthly_trend series and competition
-- scores to verify enrichment logic correctness.
--
-- Fixture scenarios:
-- 1. Low competition (0.0), stable trend
-- 2. Medium competition (0.5), rising trend
-- 3. High competition (1.0), seasonal peak in December
-- ============================================================================

-- Clean up existing test fixtures
DELETE FROM public.keywords
WHERE term IN (
  'test_low_comp_stable',
  'test_med_comp_rising',
  'test_high_comp_seasonal'
);

-- Fixture 1: Low competition, stable trend
-- Expected: high base_demand_index, low competition_score, high ai_opportunity_score
INSERT INTO public.keywords (
  term,
  source,
  market,
  method,
  tier,
  extras
)
VALUES (
  'test_low_comp_stable',
  'test_fixture',
  'US',
  'dataforseo_k4k_standard',
  1,
  jsonb_build_object(
    'monthly_trend', jsonb_build_array(
      jsonb_build_object('year', 2024, 'month', 12, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 11, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 10, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 9, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 8, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 7, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 6, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 5, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 4, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 3, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 2, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 1, 'searches', 1000)
    ),
    'dataforseo', jsonb_build_object(
      'competition', 0.0,
      'search_volume', 1000,
      'cpc', 1.5
    )
  )
);

-- Fixture 2: Medium competition, rising trend
-- Expected: medium base_demand_index, medium competition_score, positive trend_momentum
INSERT INTO public.keywords (
  term,
  source,
  market,
  method,
  tier,
  extras
)
VALUES (
  'test_med_comp_rising',
  'test_fixture',
  'US',
  'dataforseo_k4k_standard',
  1,
  jsonb_build_object(
    'monthly_trend', jsonb_build_array(
      jsonb_build_object('year', 2024, 'month', 12, 'searches', 2000),
      jsonb_build_object('year', 2024, 'month', 11, 'searches', 1800),
      jsonb_build_object('year', 2024, 'month', 10, 'searches', 1600),
      jsonb_build_object('year', 2024, 'month', 9, 'searches', 1400),
      jsonb_build_object('year', 2024, 'month', 8, 'searches', 1200),
      jsonb_build_object('year', 2024, 'month', 7, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 6, 'searches', 800),
      jsonb_build_object('year', 2024, 'month', 5, 'searches', 600),
      jsonb_build_object('year', 2024, 'month', 4, 'searches', 500),
      jsonb_build_object('year', 2024, 'month', 3, 'searches', 400),
      jsonb_build_object('year', 2024, 'month', 2, 'searches', 300),
      jsonb_build_object('year', 2024, 'month', 1, 'searches', 200)
    ),
    'dataforseo', jsonb_build_object(
      'competition', 0.5,
      'search_volume', 1000,
      'cpc', 2.0
    )
  )
);

-- Fixture 3: High competition, seasonal peak in December
-- Expected: low ai_opportunity_score, seasonal_label = 'December_peak'
INSERT INTO public.keywords (
  term,
  source,
  market,
  method,
  tier,
  extras
)
VALUES (
  'test_high_comp_seasonal',
  'test_fixture',
  'US',
  'dataforseo_k4k_standard',
  1,
  jsonb_build_object(
    'monthly_trend', jsonb_build_array(
      jsonb_build_object('year', 2024, 'month', 12, 'searches', 5000),
      jsonb_build_object('year', 2024, 'month', 11, 'searches', 3000),
      jsonb_build_object('year', 2024, 'month', 10, 'searches', 1000),
      jsonb_build_object('year', 2024, 'month', 9, 'searches', 800),
      jsonb_build_object('year', 2024, 'month', 8, 'searches', 700),
      jsonb_build_object('year', 2024, 'month', 7, 'searches', 600),
      jsonb_build_object('year', 2024, 'month', 6, 'searches', 500),
      jsonb_build_object('year', 2024, 'month', 5, 'searches', 500),
      jsonb_build_object('year', 2024, 'month', 4, 'searches', 500),
      jsonb_build_object('year', 2024, 'month', 3, 'searches', 600),
      jsonb_build_object('year', 2024, 'month', 2, 'searches', 700),
      jsonb_build_object('year', 2024, 'month', 1, 'searches', 800)
    ),
    'dataforseo', jsonb_build_object(
      'competition', 1.0,
      'search_volume', 1500,
      'cpc', 3.5
    )
  )
);

-- ============================================================================
-- Enrichment execution and validation
-- ============================================================================

-- Run enrichment on test fixtures
SELECT enrich_dataforseo_k4k_metrics(
  p_where_clause := 'term IN (''test_low_comp_stable'', ''test_med_comp_rising'', ''test_high_comp_seasonal'')',
  p_limit := NULL,
  p_dry_run := false
);

-- Validation queries
-- ============================================================================

-- 1. Check that all indices are in [0,1] range
SELECT
  term,
  base_demand_index,
  competition_score,
  engagement_score,
  trend_momentum,
  deseasoned_trend_momentum,
  adjusted_demand_index,
  ai_opportunity_score,
  CASE
    WHEN base_demand_index BETWEEN 0 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS base_di_check,
  CASE
    WHEN competition_score BETWEEN 0 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS comp_check,
  CASE
    WHEN engagement_score BETWEEN 0 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS engage_check,
  CASE
    WHEN trend_momentum BETWEEN -1 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS trend_check,
  CASE
    WHEN deseasoned_trend_momentum BETWEEN -1 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS deseason_check,
  CASE
    WHEN adjusted_demand_index BETWEEN 0 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS adj_di_check,
  CASE
    WHEN ai_opportunity_score BETWEEN 0 AND 1 THEN 'OK' ELSE 'FAIL'
  END AS ai_opp_check
FROM public.keywords
WHERE term IN (
  'test_low_comp_stable',
  'test_med_comp_rising',
  'test_high_comp_seasonal'
)
ORDER BY term;

-- 2. Check seasonal label for high_comp_seasonal fixture
-- Should be 'December_peak'
SELECT
  term,
  seasonal_label,
  CASE
    WHEN seasonal_label = 'December_peak' THEN 'OK' ELSE 'FAIL'
  END AS seasonal_label_check
FROM public.keywords
WHERE term = 'test_high_comp_seasonal';

-- 3. Check that low competition has higher ai_opportunity_score than high competition
SELECT
  'Competition vs Opportunity' AS test_name,
  CASE
    WHEN (
      SELECT ai_opportunity_score
      FROM public.keywords
      WHERE term = 'test_low_comp_stable'
    ) > (
      SELECT ai_opportunity_score
      FROM public.keywords
      WHERE term = 'test_high_comp_seasonal'
    )
    THEN 'OK'
    ELSE 'FAIL'
  END AS result;

-- 4. Check that rising trend has positive trend_momentum
SELECT
  term,
  trend_momentum,
  CASE
    WHEN trend_momentum > 0 THEN 'OK' ELSE 'FAIL'
  END AS rising_trend_check
FROM public.keywords
WHERE term = 'test_med_comp_rising';

-- 5. Check idempotency - run enrichment again and verify no changes
-- First, capture current state
CREATE TEMP TABLE IF NOT EXISTS enrichment_snapshot AS
SELECT
  id,
  term,
  base_demand_index,
  competition_score,
  engagement_score,
  trend_momentum,
  deseasoned_trend_momentum,
  seasonal_label,
  adjusted_demand_index,
  ai_opportunity_score
FROM public.keywords
WHERE term IN (
  'test_low_comp_stable',
  'test_med_comp_rising',
  'test_high_comp_seasonal'
);

-- Run enrichment again
SELECT enrich_dataforseo_k4k_metrics(
  p_where_clause := 'term IN (''test_low_comp_stable'', ''test_med_comp_rising'', ''test_high_comp_seasonal'')',
  p_limit := NULL,
  p_dry_run := false
);

-- Compare with snapshot
SELECT
  'Idempotency Test' AS test_name,
  COUNT(*) AS total_rows,
  SUM(
    CASE
      WHEN ABS(k.base_demand_index - s.base_demand_index) > 0.0001
        OR ABS(k.competition_score - s.competition_score) > 0.0001
        OR ABS(k.engagement_score - s.engagement_score) > 0.0001
        OR ABS(k.trend_momentum - s.trend_momentum) > 0.0001
        OR ABS(k.deseasoned_trend_momentum - s.deseasoned_trend_momentum) > 0.0001
        OR ABS(k.adjusted_demand_index - s.adjusted_demand_index) > 0.0001
        OR ABS(k.ai_opportunity_score - s.ai_opportunity_score) > 0.0001
      THEN 1
      ELSE 0
    END
  ) AS changed_rows,
  CASE
    WHEN SUM(
      CASE
        WHEN ABS(k.base_demand_index - s.base_demand_index) > 0.0001
          OR ABS(k.competition_score - s.competition_score) > 0.0001
          OR ABS(k.engagement_score - s.engagement_score) > 0.0001
          OR ABS(k.trend_momentum - s.trend_momentum) > 0.0001
          OR ABS(k.deseasoned_trend_momentum - s.deseasoned_trend_momentum) > 0.0001
          OR ABS(k.adjusted_demand_index - s.adjusted_demand_index) > 0.0001
          OR ABS(k.ai_opportunity_score - s.ai_opportunity_score) > 0.0001
        THEN 1
        ELSE 0
      END
    ) = 0
    THEN 'OK'
    ELSE 'FAIL'
  END AS result
FROM public.keywords k
JOIN enrichment_snapshot s ON k.id = s.id;

-- Cleanup temp table
DROP TABLE IF EXISTS enrichment_snapshot;

-- ============================================================================
-- Summary
-- ============================================================================
SELECT
  'Test Fixtures Created and Validated' AS status,
  COUNT(*) AS fixture_count
FROM public.keywords
WHERE term IN (
  'test_low_comp_stable',
  'test_med_comp_rising',
  'test_high_comp_seasonal'
);
