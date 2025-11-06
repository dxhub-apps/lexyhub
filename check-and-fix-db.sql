-- ============================================
-- Database Schema Check and Fix Script
-- Run this in Supabase SQL Editor to verify and fix the Pinterest integration
-- ============================================

-- 1. Check if social_mentions column exists in keyword_metrics_daily
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'keyword_metrics_daily'
AND column_name IN ('social_mentions', 'social_sentiment', 'social_platforms')
ORDER BY column_name;

-- 2. Check if api_usage_tracking table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'api_usage_tracking';

-- 3. Check if feature_flags table exists and has pinterest_collection
SELECT key, is_enabled, rollout
FROM feature_flags
WHERE key = 'pinterest_collection';

-- ============================================
-- If any of the above return empty results, the migration needs to be applied
-- Run these commands in Supabase Dashboard:
-- 1. Go to Database > Migrations
-- 2. Click "Run migrations"
-- OR manually run the migration file 0031_social_metrics_and_watchlist.sql
-- ============================================

-- If you want to manually enable the feature flag (if it's disabled):
-- UPDATE feature_flags
-- SET is_enabled = true
-- WHERE key = 'pinterest_collection';
