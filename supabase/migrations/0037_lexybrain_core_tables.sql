-- =====================================================
-- LexyBrain Core Tables Migration
-- =====================================================
-- This migration creates all core tables needed for LexyBrain:
-- - AI insights cache
-- - AI usage tracking
-- - AI failure logging
-- - Prompt configuration management
-- - Enhanced plan entitlements for AI features
-- - Vector embeddings for keyword similarity
-- =====================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 1. AI INSIGHTS CACHE
-- =====================================================
-- Stores generated AI insights with TTL for caching
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('market_brief', 'radar', 'ad_insight', 'risk')),
  input_hash text NOT NULL,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_json jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ttl_minutes int NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'error', 'stale')),
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on type + input_hash for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS ai_insights_type_hash_idx ON public.ai_insights (type, input_hash);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS ai_insights_expires_at_idx ON public.ai_insights (expires_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS ai_insights_user_id_idx ON public.ai_insights (user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_insights_updated_at_trigger
  BEFORE UPDATE ON public.ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_insights_updated_at();

-- Row Level Security
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Users can only see their own insights (or anonymous insights)
CREATE POLICY ai_insights_user_policy ON public.ai_insights
  FOR SELECT
  USING (
    user_id IS NULL OR
    user_id = auth.uid()
  );

-- =====================================================
-- 2. AI USAGE EVENTS
-- =====================================================
-- Tracks all AI operations for analytics and billing
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('market_brief', 'radar', 'ad_insight', 'risk', 'graph')),
  tokens_in int,
  tokens_out int,
  cache_hit bool DEFAULT false,
  latency_ms int,
  cost_cents int,
  model_version text,
  plan_code text,
  ts timestamptz NOT NULL DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS ai_usage_events_user_id_ts_idx ON public.ai_usage_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_type_ts_idx ON public.ai_usage_events (type, ts DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_cache_hit_idx ON public.ai_usage_events (cache_hit);

-- Row Level Security
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage events
CREATE POLICY ai_usage_events_user_policy ON public.ai_usage_events
  FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- 3. AI FAILURES
-- =====================================================
-- Logs AI operation failures for debugging
CREATE TABLE IF NOT EXISTS public.ai_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type text NOT NULL,
  error_code text,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);

-- Index for debugging queries
CREATE INDEX IF NOT EXISTS ai_failures_ts_idx ON public.ai_failures (ts DESC);
CREATE INDEX IF NOT EXISTS ai_failures_type_idx ON public.ai_failures (type);
CREATE INDEX IF NOT EXISTS ai_failures_error_code_idx ON public.ai_failures (error_code);

-- Row Level Security (admin-only access via service role)
ALTER TABLE public.ai_failures ENABLE ROW LEVEL SECURITY;

-- No user access to failures table (service role only)
-- Admin access is handled via service role key

-- =====================================================
-- 4. LEXYBRAIN PROMPT CONFIGS
-- =====================================================
-- Admin-configurable prompt settings per insight type
CREATE TABLE IF NOT EXISTS public.lexybrain_prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('market_brief', 'radar', 'ad_insight', 'risk', 'global')),
  system_instructions text NOT NULL,
  constraints jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, type)
);

-- Ensure only one active config per type
CREATE UNIQUE INDEX IF NOT EXISTS lexybrain_prompt_configs_active_type_idx
  ON public.lexybrain_prompt_configs (type)
  WHERE is_active = true;

-- Index for lookups
CREATE INDEX IF NOT EXISTS lexybrain_prompt_configs_type_active_idx
  ON public.lexybrain_prompt_configs (type, is_active);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lexybrain_prompt_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lexybrain_prompt_configs_updated_at_trigger
  BEFORE UPDATE ON public.lexybrain_prompt_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_lexybrain_prompt_configs_updated_at();

-- Row Level Security (admin-only via service role)
ALTER TABLE public.lexybrain_prompt_configs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. KEYWORD EMBEDDINGS (Vector Search)
-- =====================================================
-- Stores vector embeddings for semantic keyword search
CREATE TABLE IF NOT EXISTS public.keyword_embeddings (
  keyword_id uuid PRIMARY KEY REFERENCES public.keywords(id) ON DELETE CASCADE,
  embedding vector(384) NOT NULL,  -- Using 384-dim embeddings (e.g., all-MiniLM-L6-v2)
  model_name text NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS keyword_embeddings_hnsw_idx
  ON public.keyword_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_keyword_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER keyword_embeddings_updated_at_trigger
  BEFORE UPDATE ON public.keyword_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_keyword_embeddings_updated_at();

-- =====================================================
-- 6. EXTEND PLAN ENTITLEMENTS FOR LEXYBRAIN
-- =====================================================
-- Add LexyBrain-specific columns to plan_entitlements if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'ai_calls_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN ai_calls_per_month int NOT NULL DEFAULT 20;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'briefs_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN briefs_per_month int NOT NULL DEFAULT 2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'sims_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN sims_per_month int NOT NULL DEFAULT 2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'extension_boost'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN extension_boost jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- =====================================================
-- 7. SEED DEFAULT PLAN ENTITLEMENTS
-- =====================================================
-- Insert or update default plan entitlements for LexyBrain features
INSERT INTO public.plan_entitlements (
  plan_code,
  searches_per_month,
  ai_opportunities_per_month,
  niches_max,
  ai_calls_per_month,
  briefs_per_month,
  sims_per_month,
  extension_boost
) VALUES
  ('free', 10, 10, 1, 20, 2, 2, '{"ai_calls_multiplier": 2}'::jsonb),
  ('basic', 100, 100, 10, 200, 20, 20, '{}'::jsonb),
  ('pro', 500, 500, 50, 2000, 100, 200, '{}'::jsonb),
  ('growth', -1, -1, -1, -1, -1, -1, '{}'::jsonb),
  ('admin', -1, -1, -1, -1, -1, -1, '{}'::jsonb)
ON CONFLICT (plan_code) DO UPDATE SET
  ai_calls_per_month = EXCLUDED.ai_calls_per_month,
  briefs_per_month = EXCLUDED.briefs_per_month,
  sims_per_month = EXCLUDED.sims_per_month,
  extension_boost = EXCLUDED.extension_boost;

-- =====================================================
-- 8. SEED DEFAULT PROMPT CONFIGS
-- =====================================================
-- Insert default prompt configurations
INSERT INTO public.lexybrain_prompt_configs (name, type, system_instructions, constraints, is_active) VALUES
  (
    'default_global',
    'global',
    'You are LexyBrain, an AI market intelligence system for Etsy and marketplace sellers. You provide data-driven insights based on keyword metrics, trends, and competition analysis. Always return valid JSON with no markdown formatting or code fences.',
    '{"temperature": 0.3, "max_tokens": 2048, "deterministic": true}'::jsonb,
    true
  ),
  (
    'default_market_brief',
    'market_brief',
    'Generate a comprehensive market brief analyzing the provided niche and keywords. Focus on opportunities, risks, and actionable recommendations for Etsy sellers.',
    '{"max_opportunities": 5, "max_risks": 3, "max_actions": 5, "min_confidence": 0.7}'::jsonb,
    true
  ),
  (
    'default_radar',
    'radar',
    'Identify top keyword opportunities from the provided market data. Score each keyword across demand, momentum, competition, novelty, and profit potential.',
    '{"max_items": 10, "score_range": [0, 1], "require_comment": true}'::jsonb,
    true
  ),
  (
    'default_ad_insight',
    'ad_insight',
    'Generate advertising budget recommendations for the provided keywords. Calculate expected CPC, clicks, and budget allocation.',
    '{"max_terms": 8, "min_daily_cents": 100, "max_daily_cents": 50000}'::jsonb,
    true
  ),
  (
    'default_risk',
    'risk',
    'Identify potential risks and issues with the provided keywords. Focus on competition saturation, trend decline, and market challenges.',
    '{"max_alerts": 5, "severity_levels": ["low", "medium", "high"]}'::jsonb,
    true
  )
ON CONFLICT (name, type) DO NOTHING;

-- =====================================================
-- 9. RPC FUNCTIONS FOR VECTOR SEARCH
-- =====================================================

-- Search keywords by vector similarity
CREATE OR REPLACE FUNCTION search_keywords_by_embedding(
  p_query_embedding vector(384),
  p_market text,
  p_k int DEFAULT 10
) RETURNS TABLE (
  keyword_id uuid,
  term text,
  market text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id AS keyword_id,
    k.term,
    k.market,
    k.demand_index,
    k.competition_score,
    k.trend_momentum,
    1 - (ke.embedding <=> p_query_embedding) AS similarity
  FROM public.keywords k
  INNER JOIN public.keyword_embeddings ke ON ke.keyword_id = k.id
  WHERE k.market = p_market
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_k;
END;
$$ LANGUAGE plpgsql STABLE;

-- Find similar keywords to a given keyword
CREATE OR REPLACE FUNCTION similar_keywords(
  p_keyword_id uuid,
  p_k int DEFAULT 10
) RETURNS TABLE (
  keyword_id uuid,
  term text,
  market text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id AS keyword_id,
    k.term,
    k.market,
    k.demand_index,
    k.competition_score,
    k.trend_momentum,
    1 - (ke.embedding <=> ref.embedding) AS similarity
  FROM public.keywords k
  INNER JOIN public.keyword_embeddings ke ON ke.keyword_id = k.id
  CROSS JOIN public.keyword_embeddings ref
  WHERE ref.keyword_id = p_keyword_id
    AND k.id != p_keyword_id
    AND k.market = (SELECT market FROM public.keywords WHERE id = p_keyword_id)
  ORDER BY ke.embedding <=> ref.embedding
  LIMIT p_k;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get niche context (keywords + metrics for a set of terms)
CREATE OR REPLACE FUNCTION niche_context(
  p_terms text[],
  p_market text,
  p_limit int DEFAULT 50
) RETURNS TABLE (
  keyword_id uuid,
  term text,
  market text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  engagement_score numeric,
  ai_opportunity_score numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id AS keyword_id,
    k.term,
    k.market,
    k.demand_index,
    k.competition_score,
    k.trend_momentum,
    k.engagement_score,
    k.ai_opportunity_score
  FROM public.keywords k
  WHERE k.market = p_market
    AND (
      k.term = ANY(p_terms) OR
      EXISTS (
        SELECT 1 FROM unnest(p_terms) AS pt
        WHERE k.term ILIKE '%' || pt || '%'
      )
    )
  ORDER BY k.ai_opportunity_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 10. CLEANUP FUNCTION FOR EXPIRED INSIGHTS
-- =====================================================
-- Function to clean up expired AI insights (call via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_ai_insights()
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.ai_insights
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. ANALYTICS VIEWS
-- =====================================================
-- Materialized view for LexyBrain usage analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.lexybrain_usage_summary AS
SELECT
  DATE_TRUNC('day', ts) AS date,
  type,
  COUNT(*) AS total_requests,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) AS cache_hits,
  AVG(latency_ms) AS avg_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_latency_ms,
  SUM(tokens_in) AS total_tokens_in,
  SUM(tokens_out) AS total_tokens_out,
  SUM(cost_cents) AS total_cost_cents
FROM public.ai_usage_events
GROUP BY DATE_TRUNC('day', ts), type;

CREATE UNIQUE INDEX IF NOT EXISTS lexybrain_usage_summary_date_type_idx
  ON public.lexybrain_usage_summary (date, type);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- All LexyBrain core tables, indexes, RLS policies, and functions are now in place.
-- Next steps:
-- 1. Implement lib/lexybrain-*.ts modules
-- 2. Create API endpoints
-- 3. Build UI components
-- =====================================================
