-- Migration: Extension Advanced Features
-- Tables for session recording, opportunity snapshots, briefs, and community signals

-- Extension Sessions: Track user search sessions
CREATE TABLE IF NOT EXISTS extension_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  market TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  search_queries TEXT[] DEFAULT '{}',
  clicked_listings JSONB DEFAULT '[]'::jsonb,
  terms_discovered TEXT[] DEFAULT '{}',
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX idx_extension_sessions_user_date ON extension_sessions(user_id, started_at DESC);
CREATE INDEX idx_extension_sessions_market ON extension_sessions(market);

-- Listing Snapshots: Store outrank difficulty analysis
CREATE TABLE IF NOT EXISTS listing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_url TEXT NOT NULL,
  market TEXT NOT NULL,
  listing_metadata JSONB NOT NULL,
  difficulty_score NUMERIC,
  competitor_data JSONB,
  improvement_hints JSONB,
  main_keyword TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_snapshots_user_date ON listing_snapshots(user_id, created_at DESC);
CREATE INDEX idx_listing_snapshots_market ON listing_snapshots(market);
CREATE INDEX idx_listing_snapshots_keyword ON listing_snapshots(main_keyword);

-- Extension Briefs: Store generated keyword briefs
CREATE TABLE IF NOT EXISTS extension_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  market TEXT NOT NULL,
  terms TEXT[] NOT NULL,
  clusters JSONB,
  executive_summary TEXT,
  opportunity_analysis JSONB,
  recommended_actions JSONB,
  ai_insights TEXT,
  model TEXT,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extension_briefs_user_date ON extension_briefs(user_id, created_at DESC);
CREATE INDEX idx_extension_briefs_market ON extension_briefs(market);

-- Community Signals: Aggregate anonymous trending data
CREATE TABLE IF NOT EXISTS community_signals (
  id BIGSERIAL PRIMARY KEY,
  term TEXT NOT NULL,
  market TEXT NOT NULL,
  discovery_count INT NOT NULL DEFAULT 1,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(term, market, recorded_date)
);

CREATE INDEX idx_community_signals_date_count ON community_signals(recorded_date DESC, discovery_count DESC);
CREATE INDEX idx_community_signals_term_market ON community_signals(term, market);

-- Remote Config: Feature flags and kill switches
CREATE TABLE IF NOT EXISTS extension_remote_config (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default config
INSERT INTO extension_remote_config (key, value, description) VALUES
  ('domain_etsy_enabled', 'true'::jsonb, 'Enable Etsy domain parsing'),
  ('domain_amazon_enabled', 'true'::jsonb, 'Enable Amazon domain parsing'),
  ('domain_shopify_enabled', 'true'::jsonb, 'Enable Shopify domain parsing'),
  ('domain_google_enabled', 'true'::jsonb, 'Enable Google Search parsing'),
  ('domain_bing_enabled', 'true'::jsonb, 'Enable Bing Search parsing'),
  ('domain_pinterest_enabled', 'true'::jsonb, 'Enable Pinterest parsing'),
  ('domain_reddit_enabled', 'true'::jsonb, 'Enable Reddit parsing'),
  ('highlight_max_per_page', '300'::jsonb, 'Maximum highlights per page'),
  ('metrics_cache_ttl_seconds', '3600'::jsonb, 'Metrics cache TTL in seconds'),
  ('batch_size_max', '10'::jsonb, 'Maximum terms per batch request'),
  ('rate_limit_per_minute', '100'::jsonb, 'API requests per minute per user')
ON CONFLICT (key) DO NOTHING;

-- User Extension Settings: Per-user preferences
CREATE TABLE IF NOT EXISTS user_extension_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_toggles JSONB DEFAULT '{
    "etsy": true,
    "amazon": true,
    "shopify": true,
    "google": true,
    "bing": true,
    "pinterest": false,
    "reddit": false
  }'::jsonb,
  community_signal_opt_in BOOLEAN DEFAULT false,
  highlight_color TEXT DEFAULT 'yellow',
  tooltip_delay_ms INT DEFAULT 300,
  animation_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE extension_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_extension_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY extension_sessions_user_policy ON extension_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY listing_snapshots_user_policy ON listing_snapshots
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY extension_briefs_user_policy ON extension_briefs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY user_extension_settings_policy ON user_extension_settings
  FOR ALL USING (auth.uid() = user_id);

-- Community signals are read-only for all authenticated users
CREATE POLICY community_signals_read_policy ON community_signals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Remote config is read-only for all
ALTER TABLE extension_remote_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY extension_remote_config_read_policy ON extension_remote_config
  FOR SELECT TO PUBLIC USING (true);

-- Function to increment community signal
CREATE OR REPLACE FUNCTION increment_community_signal(
  p_term TEXT,
  p_market TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO community_signals (term, market, discovery_count, recorded_date)
  VALUES (p_term, p_market, 1, CURRENT_DATE)
  ON CONFLICT (term, market, recorded_date)
  DO UPDATE SET
    discovery_count = community_signals.discovery_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending terms (for Trend Whisper)
CREATE OR REPLACE FUNCTION get_trending_terms(
  p_market TEXT,
  p_days INT DEFAULT 7,
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  term TEXT,
  discovery_count BIGINT,
  trend_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.term,
    SUM(cs.discovery_count) as discovery_count,
    (SUM(cs.discovery_count)::NUMERIC / NULLIF(p_days, 0)) as trend_score
  FROM community_signals cs
  WHERE cs.market = p_market
    AND cs.recorded_date >= CURRENT_DATE - p_days
  GROUP BY cs.term
  ORDER BY trend_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE extension_sessions IS 'Tracks user keyword research sessions in extension';
COMMENT ON TABLE listing_snapshots IS 'Stores outrank difficulty analysis for listings';
COMMENT ON TABLE extension_briefs IS 'Stores AI-generated keyword briefs';
COMMENT ON TABLE community_signals IS 'Anonymous aggregate trending keyword discovery data';
COMMENT ON TABLE extension_remote_config IS 'Feature flags and configuration for extension';
COMMENT ON TABLE user_extension_settings IS 'Per-user extension preferences and toggles';
