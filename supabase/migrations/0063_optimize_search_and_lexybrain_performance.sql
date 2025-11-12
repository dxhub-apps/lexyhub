-- ===========================================
-- 0063_optimize_search_and_lexybrain_performance.sql
-- ===========================================
-- Comprehensive performance optimizations for search and LexBrain insights
-- migrate:up

-- 1. Add indexes on keywords table for faster filtering and sorting
CREATE INDEX IF NOT EXISTS keywords_demand_index_idx
  ON public.keywords(demand_index DESC NULLS LAST)
  WHERE demand_index IS NOT NULL;

CREATE INDEX IF NOT EXISTS keywords_competition_score_idx
  ON public.keywords(competition_score)
  WHERE competition_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS keywords_trend_momentum_idx
  ON public.keywords(trend_momentum DESC NULLS LAST)
  WHERE trend_momentum IS NOT NULL;

CREATE INDEX IF NOT EXISTS keywords_ai_opportunity_score_idx
  ON public.keywords(ai_opportunity_score DESC NULLS LAST)
  WHERE ai_opportunity_score IS NOT NULL;

-- Composite index for common search filters
CREATE INDEX IF NOT EXISTS keywords_market_source_tier_idx
  ON public.keywords(market, source, tier);

-- Index for faster full-text search on term
CREATE INDEX IF NOT EXISTS keywords_term_trgm_idx
  ON public.keywords USING gin(term gin_trgm_ops);

-- 2. Add embedding column to keywords table for pre-computed embeddings
-- This eliminates N+1 embedding API calls during search ranking
ALTER TABLE public.keywords
  ADD COLUMN IF NOT EXISTS embedding vector(3072);

-- Index for vector similarity search on keywords
-- Note: We use cosine distance for similarity
CREATE INDEX IF NOT EXISTS keywords_embedding_cosine_idx
  ON public.keywords
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- 3. Add search result cache table
CREATE TABLE IF NOT EXISTS public.keyword_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL UNIQUE,
  query text NOT NULL,
  market text NOT NULL,
  plan text NOT NULL,
  sources text[] NOT NULL,
  results jsonb NOT NULL,
  result_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS keyword_search_cache_query_market_idx
  ON public.keyword_search_cache(query, market, plan);

CREATE INDEX IF NOT EXISTS keyword_search_cache_created_at_idx
  ON public.keyword_search_cache(created_at DESC);

-- Automatically delete cache entries older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_old_search_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.keyword_search_cache
  WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- 4. Optimize keyword_insight_snapshots for faster snapshot reuse
CREATE INDEX IF NOT EXISTS keyword_insight_snapshots_keyword_capability_recent_idx
  ON public.keyword_insight_snapshots(keyword_id, capability, created_at DESC);

CREATE INDEX IF NOT EXISTS keyword_insight_snapshots_scope_capability_idx
  ON public.keyword_insight_snapshots(scope, capability, created_at DESC);

-- 5. Create optimized RPC function for fast keyword ranking with pre-computed embeddings
CREATE OR REPLACE FUNCTION lexy_rank_keywords(
  p_query_embedding vector(3072),
  p_market text,
  p_sources text[],
  p_tiers text[],
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  term text,
  market text,
  source text,
  tier text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  ai_opportunity_score numeric,
  engagement_score numeric,
  extras jsonb,
  search_volume numeric,
  cpc numeric,
  monthly_trend jsonb,
  dataforseo_competition numeric,
  freshness_ts timestamptz,
  similarity double precision,
  composite_score double precision,
  ranking_score double precision
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query_lower text;
BEGIN
  v_query_lower := LOWER(TRIM(p_query));

  RETURN QUERY
  WITH candidates AS (
    SELECT
      k.id,
      k.term,
      k.market,
      k.source,
      k.tier,
      k.demand_index,
      k.competition_score,
      k.trend_momentum,
      k.ai_opportunity_score,
      k.engagement_score,
      k.extras,
      k.search_volume,
      k.cpc,
      k.monthly_trend,
      k.dataforseo_competition,
      k.freshness_ts,
      k.embedding,
      -- Check if exact match
      CASE WHEN LOWER(k.term) = v_query_lower THEN true ELSE false END as is_exact
    FROM public.keywords k
    WHERE
      k.market = p_market
      AND k.source = ANY(p_sources)
      AND k.tier = ANY(p_tiers)
      AND k.term IS NOT NULL
      AND k.term != ''
      AND k.term ILIKE '%' || p_query || '%'
    LIMIT GREATEST(p_limit * 6, 150)
  ),
  ranked AS (
    SELECT
      c.*,
      -- Calculate cosine similarity (only if embedding exists)
      CASE
        WHEN c.embedding IS NOT NULL AND p_query_embedding IS NOT NULL THEN
          1 - (c.embedding <=> p_query_embedding)
        ELSE 0.5
      END as sim,
      -- Calculate composite score
      (
        0.4 * COALESCE(LEAST(c.demand_index, 1), 0.55) +
        0.3 * (1 - COALESCE(LEAST(c.competition_score, 1), 0.45)) +
        0.3 * COALESCE(LEAST(c.trend_momentum, 1), 0.5)
      ) as comp_score
    FROM candidates c
  )
  SELECT
    r.id,
    r.term,
    r.market,
    r.source,
    r.tier,
    r.demand_index,
    r.competition_score,
    r.trend_momentum,
    r.ai_opportunity_score,
    r.engagement_score,
    r.extras,
    r.search_volume,
    r.cpc,
    r.monthly_trend,
    r.dataforseo_competition,
    r.freshness_ts,
    r.sim::double precision as similarity,
    r.comp_score::double precision as composite_score,
    -- Calculate final ranking score (exact matches get max score)
    CASE
      WHEN r.is_exact THEN 999999999.0
      ELSE (r.sim * 0.55 + r.comp_score * 0.45)
    END::double precision as ranking_score
  FROM ranked r
  ORDER BY ranking_score DESC
  LIMIT p_limit;
END;
$$;

-- 6. Create helper function to check for recent snapshots
CREATE OR REPLACE FUNCTION lexy_get_recent_snapshot(
  p_keyword_id uuid,
  p_capability text,
  p_max_age_minutes integer DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  keyword_id uuid,
  capability text,
  scope text,
  insight jsonb,
  references jsonb,
  metrics_used jsonb,
  created_at timestamptz,
  age_minutes integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.keyword_id,
    s.capability,
    s.scope,
    s.insight,
    s.references,
    s.metrics_used,
    s.created_at,
    EXTRACT(EPOCH FROM (NOW() - s.created_at))::integer / 60 as age_minutes
  FROM public.keyword_insight_snapshots s
  WHERE
    s.keyword_id = p_keyword_id
    AND s.capability = p_capability
    AND s.created_at > NOW() - (p_max_age_minutes || ' minutes')::interval
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- 7. Add pg_trgm extension for faster text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 8. Grant necessary permissions
GRANT EXECUTE ON FUNCTION lexy_rank_keywords TO authenticated, anon;
GRANT EXECUTE ON FUNCTION lexy_get_recent_snapshot TO authenticated, anon;
GRANT EXECUTE ON FUNCTION cleanup_old_search_cache TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.keyword_search_cache TO authenticated, anon;

-- 9. Add comment documentation
COMMENT ON FUNCTION lexy_rank_keywords IS 'Optimized keyword ranking with pre-computed embeddings to avoid N+1 API calls';
COMMENT ON FUNCTION lexy_get_recent_snapshot IS 'Retrieve recent LexBrain insight snapshots to avoid regenerating fresh insights';
COMMENT ON TABLE public.keyword_search_cache IS 'Cache for search API results to reduce database load';
COMMENT ON COLUMN public.keywords.embedding IS 'Pre-computed OpenAI embedding (3072D) for fast semantic search ranking';

-- migrate:down

-- Remove functions
DROP FUNCTION IF EXISTS lexy_rank_keywords;
DROP FUNCTION IF EXISTS lexy_get_recent_snapshot;
DROP FUNCTION IF EXISTS cleanup_old_search_cache;

-- Remove table
DROP TABLE IF EXISTS public.keyword_search_cache;

-- Remove indexes
DROP INDEX IF EXISTS keywords_demand_index_idx;
DROP INDEX IF EXISTS keywords_competition_score_idx;
DROP INDEX IF EXISTS keywords_trend_momentum_idx;
DROP INDEX IF EXISTS keywords_ai_opportunity_score_idx;
DROP INDEX IF EXISTS keywords_market_source_tier_idx;
DROP INDEX IF EXISTS keywords_term_trgm_idx;
DROP INDEX IF EXISTS keywords_embedding_cosine_idx;
DROP INDEX IF EXISTS keyword_insight_snapshots_keyword_capability_recent_idx;
DROP INDEX IF EXISTS keyword_insight_snapshots_scope_capability_idx;

-- Remove column
ALTER TABLE public.keywords DROP COLUMN IF EXISTS embedding;
