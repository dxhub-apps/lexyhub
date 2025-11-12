-- =====================================================
-- Apply DataForSEO Column Migration
-- =====================================================
-- This script:
-- 1. Truncates the keywords table (DESTRUCTIVE - all data lost)
-- 2. Adds DataForSEO columns (search_volume, cpc, dataforseo_competition, monthly_trend)
-- 3. Updates the lexy_upsert_keyword function to populate these columns
-- 4. Creates indexes for performance
--
-- IMPORTANT: Run this against your Supabase database
-- USE WITH CAUTION: This will delete all keyword data!
-- =====================================================

-- Step 1: Truncate keywords table
-- WARNING: THIS DELETES ALL DATA IN public.keywords AND ALL RELATED DATA
BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'TRUNCATING public.keywords table...';
  TRUNCATE TABLE public.keywords CASCADE;
  RAISE NOTICE 'Truncation complete.';
END $$;

COMMIT;

-- Step 2: Add DataForSEO columns
BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Adding DataForSEO columns to public.keywords...';
END $$;

-- Add DataForSEO metric columns to keywords table
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS search_volume integer,
  ADD COLUMN IF NOT EXISTS cpc numeric(10,2),
  ADD COLUMN IF NOT EXISTS dataforseo_competition numeric(5,4),
  ADD COLUMN IF NOT EXISTS monthly_trend jsonb;

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS keywords_search_volume_idx
  ON public.keywords(search_volume DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS keywords_cpc_idx
  ON public.keywords(cpc DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS keywords_dataforseo_competition_idx
  ON public.keywords(dataforseo_competition NULLS LAST);

-- Add GIN index for monthly_trend JSONB queries
CREATE INDEX IF NOT EXISTS keywords_monthly_trend_idx
  ON public.keywords USING gin(monthly_trend);

-- Add composite index for search by market + search volume (common filter)
CREATE INDEX IF NOT EXISTS keywords_market_volume_idx
  ON public.keywords(market, search_volume DESC NULLS LAST);

-- Add comments
COMMENT ON COLUMN public.keywords.search_volume IS 'Raw search volume from DataForSEO API';
COMMENT ON COLUMN public.keywords.cpc IS 'Cost per click in USD from DataForSEO API';
COMMENT ON COLUMN public.keywords.dataforseo_competition IS 'Raw competition score from DataForSEO (0-1 scale)';
COMMENT ON COLUMN public.keywords.monthly_trend IS 'Monthly search trend data from DataForSEO: [{"year": 2024, "month": 11, "searches": 1300}, ...]';

DO $$
BEGIN
  RAISE NOTICE 'DataForSEO columns and indexes created.';
END $$;

COMMIT;

-- Step 3: Update lexy_upsert_keyword function
BEGIN;

DO $$
BEGIN
  RAISE NOTICE 'Updating lexy_upsert_keyword function...';
END $$;

-- Drop existing function
DROP FUNCTION IF EXISTS public.lexy_upsert_keyword CASCADE;

-- Recreate with DataForSEO column population
CREATE OR REPLACE FUNCTION public.lexy_upsert_keyword(
  p_term text,
  p_market text,
  p_source text,
  p_tier smallint DEFAULT 0,
  p_method text DEFAULT NULL,
  p_extras jsonb DEFAULT '{}'::jsonb,
  p_demand numeric DEFAULT NULL,
  p_competition numeric DEFAULT NULL,
  p_engagement numeric DEFAULT NULL,
  p_ai numeric DEFAULT NULL,
  p_freshness timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid;
  v_tier_value smallint;
  v_search_volume integer;
  v_cpc numeric(10,2);
  v_dataforseo_competition numeric(5,4);
  v_monthly_trend jsonb;
BEGIN
  -- Explicitly cast tier to smallint
  v_tier_value := p_tier::smallint;

  -- Extract DataForSEO metrics from extras if present
  v_search_volume := (p_extras->>'search_volume')::integer;
  v_cpc := (p_extras->>'cpc')::numeric(10,2);
  v_dataforseo_competition := (p_extras->'dataforseo'->>'competition')::numeric(5,4);
  v_monthly_trend := p_extras->'monthly_trend';

  INSERT INTO public.keywords(
    term, market, source, tier, method, extras,
    demand_index, competition_score, engagement_score, ai_opportunity_score, freshness_ts,
    search_volume, cpc, dataforseo_competition, monthly_trend
  )
  VALUES (
    p_term, p_market, p_source, v_tier_value, p_method, coalesce(p_extras,'{}'::jsonb),
    public.lexy_clip01(p_demand), public.lexy_clip01(p_competition),
    public.lexy_clip01(p_engagement), public.lexy_clip01(p_ai), p_freshness,
    v_search_volume, v_cpc, v_dataforseo_competition, v_monthly_trend
  )
  ON CONFLICT (term_normalized, market, source) DO UPDATE
  SET
    tier = EXCLUDED.tier,
    method = coalesce(EXCLUDED.method, public.keywords.method),
    extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(EXCLUDED.extras,'{}'::jsonb),
    demand_index = coalesce(EXCLUDED.demand_index, public.keywords.demand_index),
    competition_score = coalesce(EXCLUDED.competition_score, public.keywords.competition_score),
    engagement_score = coalesce(EXCLUDED.engagement_score, public.keywords.engagement_score),
    ai_opportunity_score = coalesce(EXCLUDED.ai_opportunity_score, public.keywords.ai_opportunity_score),
    freshness_ts = greatest(public.keywords.freshness_ts, EXCLUDED.freshness_ts),
    -- Update DataForSEO columns
    search_volume = coalesce(EXCLUDED.search_volume, public.keywords.search_volume),
    cpc = coalesce(EXCLUDED.cpc, public.keywords.cpc),
    dataforseo_competition = coalesce(EXCLUDED.dataforseo_competition, public.keywords.dataforseo_competition),
    monthly_trend = coalesce(EXCLUDED.monthly_trend, public.keywords.monthly_trend),
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.lexy_upsert_keyword TO authenticated, service_role, anon;

-- Add helpful comment
COMMENT ON FUNCTION public.lexy_upsert_keyword IS 'Upserts keyword with DataForSEO metrics extracted from extras JSONB into dedicated columns. Tier mapping: 0=free, 1=growth, 2=scale';

DO $$
BEGIN
  RAISE NOTICE 'lexy_upsert_keyword function updated successfully.';
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run DataForSEO ingestion job to populate keywords';
  RAISE NOTICE '2. Verify data appears with search_volume, cpc, dataforseo_competition columns populated';
  RAISE NOTICE '3. Test frontend search to ensure metrics display correctly';
END $$;

COMMIT;
