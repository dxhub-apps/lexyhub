-- migrate:up
-- ===========================================
-- 0031_social_metrics_and_watchlist.sql
-- Social Media Metrics & Keyword Watchlist Integration
-- ===========================================

-- ============================================
-- 1. Extend keyword_metrics_daily for social metrics
-- ============================================

-- Add social media metrics columns
ALTER TABLE public.keyword_metrics_daily
  ADD COLUMN IF NOT EXISTS social_mentions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_sentiment NUMERIC(5,2),  -- -1.00 to 1.00
  ADD COLUMN IF NOT EXISTS social_platforms JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.keyword_metrics_daily.social_mentions IS 'Total social media mentions across all platforms';
COMMENT ON COLUMN public.keyword_metrics_daily.social_sentiment IS 'Sentiment score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN public.keyword_metrics_daily.social_platforms IS 'Platform breakdown: {"reddit": 50, "twitter": 120, "pinterest": 30}';

-- Index for social metrics queries
CREATE INDEX IF NOT EXISTS keyword_metrics_daily_social_mentions_idx
  ON public.keyword_metrics_daily(social_mentions DESC)
  WHERE social_mentions > 0;

-- ============================================
-- 2. API Usage Tracking
-- ============================================

CREATE TABLE IF NOT EXISTS public.api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,  -- 'twitter', 'pinterest', 'reddit', 'tiktok', 'google_trends'
  period TEXT NOT NULL,   -- 'YYYY-MM' format (e.g., '2025-11')
  requests_made INTEGER DEFAULT 0,
  limit_per_period INTEGER NOT NULL,
  last_request_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service, period)
);

COMMENT ON TABLE public.api_usage_tracking IS 'Tracks API usage for rate-limited services to prevent quota overages';

CREATE INDEX IF NOT EXISTS api_usage_tracking_service_period_idx
  ON public.api_usage_tracking(service, period);

-- ============================================
-- 3. Social Platform Trends (detailed tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.social_platform_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES public.keywords(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,  -- 'reddit', 'twitter', 'pinterest', 'tiktok'
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  engagement_score NUMERIC(12,2),
  sentiment NUMERIC(5,2),  -- -1.00 to 1.00
  velocity NUMERIC(10,4),  -- Change rate from previous period
  top_posts JSONB DEFAULT '[]'::jsonb,  -- Top 5 posts/tweets/pins with links
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.social_platform_trends IS 'Platform-specific keyword trend snapshots for detailed analysis';
COMMENT ON COLUMN public.social_platform_trends.velocity IS 'Rate of change in mentions (delta from previous period)';

CREATE INDEX IF NOT EXISTS social_platform_trends_keyword_platform_idx
  ON public.social_platform_trends(keyword_id, platform, collected_at DESC);

CREATE INDEX IF NOT EXISTS social_platform_trends_platform_collected_idx
  ON public.social_platform_trends(platform, collected_at DESC);

-- ============================================
-- 4. User Keyword Watchlists
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_keyword_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES public.keywords(id) ON DELETE CASCADE,
  alert_threshold NUMERIC(6,2) DEFAULT 15.0,  -- Alert when momentum > this value
  alert_enabled BOOLEAN DEFAULT TRUE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword_id)
);

COMMENT ON TABLE public.user_keyword_watchlists IS 'User-specific keyword watchlists for monitoring trends and momentum';
COMMENT ON COLUMN public.user_keyword_watchlists.alert_threshold IS 'Momentum threshold for triggering alerts';

CREATE INDEX IF NOT EXISTS user_keyword_watchlists_user_idx
  ON public.user_keyword_watchlists(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_keyword_watchlists_keyword_idx
  ON public.user_keyword_watchlists(keyword_id);

CREATE INDEX IF NOT EXISTS user_keyword_watchlists_alerts_idx
  ON public.user_keyword_watchlists(user_id)
  WHERE alert_enabled = TRUE;

-- ============================================
-- 5. Feature Flags for Platform Control
-- ============================================
-- Note: feature_flags table already exists from migration 0018
-- Using existing structure: (key, description, is_enabled, rollout, created_at, updated_at)

-- Seed feature flags for social platforms
INSERT INTO public.feature_flags (key, description, is_enabled, rollout) VALUES
  ('reddit_collection', 'Enable Reddit keyword collection', true, '{"frequency": "*/3 * * * *", "include_comments": true}'::jsonb),
  ('twitter_collection', 'Enable Twitter/X keyword collection', true, '{"frequency": "*/30 * * * *", "monthly_limit": 1500}'::jsonb),
  ('pinterest_collection', 'Enable Pinterest keyword collection', true, '{"frequency": "15 */2 * * *", "daily_limit": 200}'::jsonb),
  ('tiktok_collection', 'Enable TikTok keyword collection (disabled by default)', false, '{"frequency": "45 */3 * * *", "method": "web_scraping"}'::jsonb),
  ('google_trends_collection', 'Enable Google Trends data collection', true, '{"frequency": "0 */2 * * *"}'::jsonb),
  ('hourly_keyword_refresh', 'Enable hourly incremental keyword updates', true, '{"max_keywords": 500, "lookback_days": 7}'::jsonb),
  ('watchlist_alerts', 'Enable watchlist momentum alerts', true, '{"check_interval_minutes": 15, "momentum_threshold": 15.0}'::jsonb),
  ('amazon_pa_api', 'Enable Amazon Product Advertising API (paid, disabled)', false, '{"api_key_secret": "AMAZON_PA_API_KEY"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 6. Helper Functions
-- ============================================

-- Function: Check if feature is enabled
CREATE OR REPLACE FUNCTION public.is_feature_enabled(p_flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM public.feature_flags
  WHERE key = p_flag_key;

  RETURN COALESCE(v_enabled, false);
END;
$$;

COMMENT ON FUNCTION public.is_feature_enabled IS 'Check if a feature flag is enabled';

-- Function: Get feature config
CREATE OR REPLACE FUNCTION public.get_feature_config(p_flag_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT rollout INTO v_config
  FROM public.feature_flags
  WHERE key = p_flag_key AND is_enabled = true;

  RETURN COALESCE(v_config, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_feature_config IS 'Get configuration for an enabled feature flag';

-- Function: Track API usage
CREATE OR REPLACE FUNCTION public.track_api_usage(
  p_service TEXT,
  p_requests INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_period TEXT;
  v_current_count INTEGER;
  v_limit INTEGER;
BEGIN
  v_period := TO_CHAR(NOW(), 'YYYY-MM');

  -- Upsert usage record
  INSERT INTO public.api_usage_tracking (service, period, requests_made, limit_per_period, last_request_at)
  VALUES (
    p_service,
    v_period,
    p_requests,
    CASE p_service
      WHEN 'twitter' THEN 1500
      WHEN 'pinterest' THEN 6000  -- 200/day * 30 days
      WHEN 'reddit' THEN 999999   -- Effectively unlimited
      WHEN 'google_trends' THEN 999999
      WHEN 'tiktok' THEN 0
      ELSE 1000
    END,
    NOW()
  )
  ON CONFLICT (service, period) DO UPDATE SET
    requests_made = api_usage_tracking.requests_made + p_requests,
    last_request_at = NOW(),
    updated_at = NOW();

  -- Check if we're approaching limit
  SELECT requests_made, limit_per_period INTO v_current_count, v_limit
  FROM public.api_usage_tracking
  WHERE service = p_service AND period = v_period;

  IF v_current_count >= v_limit * 0.9 THEN
    RAISE WARNING 'API usage for % is at % of % limit (90%% threshold)', p_service, v_current_count, v_limit;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.track_api_usage IS 'Track and monitor API usage with automatic warnings';

-- Function: Get keywords on watchlists (for prioritization)
CREATE OR REPLACE FUNCTION public.get_watched_keywords(
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  keyword_id UUID,
  term TEXT,
  watchers INTEGER,
  avg_alert_threshold NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id AS keyword_id,
    k.term,
    COUNT(DISTINCT w.user_id)::INTEGER AS watchers,
    AVG(w.alert_threshold) AS avg_alert_threshold
  FROM public.keywords k
  INNER JOIN public.user_keyword_watchlists w ON w.keyword_id = k.id
  WHERE w.alert_enabled = true
  GROUP BY k.id, k.term
  ORDER BY COUNT(DISTINCT w.user_id) DESC, k.freshness_ts DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_watched_keywords IS 'Get keywords on user watchlists for prioritized collection';

-- ============================================
-- 7. Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on watchlists
ALTER TABLE public.user_keyword_watchlists ENABLE ROW LEVEL SECURITY;

-- Users can view their own watchlists
CREATE POLICY user_keyword_watchlists_select_own
  ON public.user_keyword_watchlists
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own watchlists
CREATE POLICY user_keyword_watchlists_insert_own
  ON public.user_keyword_watchlists
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watchlists
CREATE POLICY user_keyword_watchlists_update_own
  ON public.user_keyword_watchlists
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own watchlists
CREATE POLICY user_keyword_watchlists_delete_own
  ON public.user_keyword_watchlists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can access all watchlists (for jobs)
CREATE POLICY user_keyword_watchlists_service_all
  ON public.user_keyword_watchlists
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 8. Grants
-- ============================================

GRANT SELECT ON public.api_usage_tracking TO anon, authenticated;
GRANT ALL ON public.api_usage_tracking TO service_role;

GRANT SELECT ON public.social_platform_trends TO anon, authenticated;
GRANT ALL ON public.social_platform_trends TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_keyword_watchlists TO authenticated;
GRANT ALL ON public.user_keyword_watchlists TO service_role;

GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;

-- migrate:down

DROP POLICY IF EXISTS user_keyword_watchlists_service_all ON public.user_keyword_watchlists;
DROP POLICY IF EXISTS user_keyword_watchlists_delete_own ON public.user_keyword_watchlists;
DROP POLICY IF EXISTS user_keyword_watchlists_update_own ON public.user_keyword_watchlists;
DROP POLICY IF EXISTS user_keyword_watchlists_insert_own ON public.user_keyword_watchlists;
DROP POLICY IF EXISTS user_keyword_watchlists_select_own ON public.user_keyword_watchlists;

DROP FUNCTION IF EXISTS public.get_watched_keywords;
DROP FUNCTION IF EXISTS public.track_api_usage;
DROP FUNCTION IF EXISTS public.get_feature_config;
DROP FUNCTION IF EXISTS public.is_feature_enabled;

-- Note: Do NOT drop feature_flags table as it existed before this migration (0018)
-- Only delete the rows we added
DELETE FROM public.feature_flags WHERE key IN (
  'reddit_collection',
  'twitter_collection',
  'pinterest_collection',
  'tiktok_collection',
  'google_trends_collection',
  'hourly_keyword_refresh',
  'watchlist_alerts',
  'amazon_pa_api'
);

DROP TABLE IF EXISTS public.user_keyword_watchlists CASCADE;
DROP TABLE IF EXISTS public.social_platform_trends CASCADE;
DROP TABLE IF EXISTS public.api_usage_tracking CASCADE;

ALTER TABLE public.keyword_metrics_daily
  DROP COLUMN IF EXISTS social_platforms,
  DROP COLUMN IF EXISTS social_sentiment,
  DROP COLUMN IF EXISTS social_mentions;
