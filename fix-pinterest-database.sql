-- ============================================
-- Pinterest Integration Database Fix
-- Run this in Supabase SQL Editor to enable Pinterest integration
-- ============================================

-- Step 1: Enable the pinterest_collection feature flag
-- This is the main issue causing "pinterest_collection:disabled by feature flag"
UPDATE feature_flags
SET is_enabled = true
WHERE key = 'pinterest_collection';

-- Verify it's enabled
SELECT key, is_enabled, rollout, description
FROM feature_flags
WHERE key = 'pinterest_collection';

-- If the feature flag doesn't exist at all, create it:
INSERT INTO feature_flags (key, description, is_enabled, rollout)
VALUES (
  'pinterest_collection',
  'Enable Pinterest keyword collection',
  true,
  '{"frequency": "15 */2 * * *", "daily_limit": 200}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET is_enabled = true;

-- ============================================
-- Step 2: Verify/Create required tables and columns
-- ============================================

-- Check if keyword_metrics_daily has social columns
-- If this returns 0 rows, the columns need to be added
SELECT COUNT(*) as social_columns_count
FROM information_schema.columns
WHERE table_name = 'keyword_metrics_daily'
AND column_name IN ('social_mentions', 'social_sentiment', 'social_platforms');

-- Add social columns if they don't exist
ALTER TABLE keyword_metrics_daily
  ADD COLUMN IF NOT EXISTS social_mentions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS social_sentiment NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS social_platforms JSONB DEFAULT '{}'::jsonb;

-- Check if api_usage_tracking table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'api_usage_tracking';

-- Create api_usage_tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  period TEXT NOT NULL,
  requests_made INTEGER DEFAULT 0,
  limit_per_period INTEGER NOT NULL,
  last_request_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service, period)
);

CREATE INDEX IF NOT EXISTS api_usage_tracking_service_period_idx
  ON api_usage_tracking(service, period);

-- Create social_platform_trends table if it doesn't exist
CREATE TABLE IF NOT EXISTS social_platform_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES keywords(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  engagement_score NUMERIC(12,2),
  sentiment NUMERIC(5,2),
  velocity NUMERIC(10,4),
  top_posts JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_platform_trends_keyword_platform_idx
  ON social_platform_trends(keyword_id, platform, collected_at DESC);

-- Create track_api_usage RPC function if it doesn't exist
CREATE OR REPLACE FUNCTION track_api_usage(
  p_service TEXT,
  p_requests INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_period TEXT;
BEGIN
  -- Use daily period for Pinterest (YYYY-MM-DD format)
  v_period := TO_CHAR(NOW(), 'YYYY-MM-DD');

  INSERT INTO api_usage_tracking (service, period, requests_made, limit_per_period, last_request_at)
  VALUES (
    p_service,
    v_period,
    p_requests,
    CASE p_service
      WHEN 'pinterest' THEN 200  -- Daily limit
      WHEN 'twitter' THEN 1500   -- Monthly limit
      WHEN 'reddit' THEN 999999
      ELSE 1000
    END,
    NOW()
  )
  ON CONFLICT (service, period) DO UPDATE SET
    requests_made = api_usage_tracking.requests_made + p_requests,
    last_request_at = NOW(),
    updated_at = NOW();
END;
$$;

-- ============================================
-- Step 3: Verify everything is set up
-- ============================================

-- Check feature flag
SELECT
  'Feature Flag' as check_type,
  CASE WHEN is_enabled THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
FROM feature_flags
WHERE key = 'pinterest_collection';

-- Check tables
SELECT
  'api_usage_tracking table' as check_type,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables
WHERE table_name = 'api_usage_tracking';

SELECT
  'social_platform_trends table' as check_type,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables
WHERE table_name = 'social_platform_trends';

-- Check columns
SELECT
  'social columns in keyword_metrics_daily' as check_type,
  CASE WHEN COUNT(*) = 3 THEN '✅ EXISTS (3/3)' ELSE '⚠️ PARTIAL (' || COUNT(*) || '/3)' END as status
FROM information_schema.columns
WHERE table_name = 'keyword_metrics_daily'
AND column_name IN ('social_mentions', 'social_sentiment', 'social_platforms');

-- Check RPC function
SELECT
  'track_api_usage function' as check_type,
  CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.routines
WHERE routine_name = 'track_api_usage'
AND routine_schema = 'public';

-- ============================================
-- All checks should show ✅ for Pinterest to work!
-- ============================================
