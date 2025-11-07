-- =====================================================
-- LexyBrain Quick Fix Script
-- =====================================================
-- This script fixes the three common errors:
-- 1. "column ai_usage_events.ts does not exist"
-- 2. "Failed to lookup plan entitlements" (admin plan)
-- 3. Missing LexyBrain-specific plan entitlement columns
--
-- Usage:
--   psql $DATABASE_URL < scripts/fix-lexybrain-errors.sql
--
-- Or with Supabase CLI:
--   supabase db execute -f scripts/fix-lexybrain-errors.sql
--
-- NOTE: This is a subset of migration 0037. If possible,
-- run the full migration instead: supabase db push
-- =====================================================

BEGIN;

\echo 'Fixing LexyBrain database errors...'
\echo ''

-- =====================================================
-- Fix 1: Create/Recreate ai_usage_events table with ts column
-- =====================================================
\echo 'Fix 1: Ensuring ai_usage_events table has correct schema...'

-- Drop old table if it exists without ts column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_usage_events'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_usage_events'
      AND column_name = 'ts'
  ) THEN
    -- Backup old data if table exists with wrong schema
    CREATE TABLE IF NOT EXISTS ai_usage_events_backup AS
    SELECT * FROM public.ai_usage_events;

    DROP TABLE public.ai_usage_events CASCADE;

    RAISE NOTICE 'Old ai_usage_events table backed up and dropped';
  END IF;
END $$;

-- Create table with correct schema
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

-- Create indexes
CREATE INDEX IF NOT EXISTS ai_usage_events_user_id_ts_idx ON public.ai_usage_events (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_type_ts_idx ON public.ai_usage_events (type, ts DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_cache_hit_idx ON public.ai_usage_events (cache_hit);

-- Enable RLS
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS ai_usage_events_user_policy ON public.ai_usage_events;
CREATE POLICY ai_usage_events_user_policy ON public.ai_usage_events
  FOR SELECT
  USING (user_id = auth.uid());

\echo '  ✓ ai_usage_events table fixed'
\echo ''

-- =====================================================
-- Fix 2: Add LexyBrain columns to plan_entitlements
-- =====================================================
\echo 'Fix 2: Adding LexyBrain columns to plan_entitlements...'

DO $$
BEGIN
  -- Add ai_calls_per_month if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'ai_calls_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN ai_calls_per_month int NOT NULL DEFAULT 20;
    RAISE NOTICE '  ✓ Added ai_calls_per_month column';
  END IF;

  -- Add briefs_per_month if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'briefs_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN briefs_per_month int NOT NULL DEFAULT 2;
    RAISE NOTICE '  ✓ Added briefs_per_month column';
  END IF;

  -- Add sims_per_month if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'sims_per_month'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN sims_per_month int NOT NULL DEFAULT 2;
    RAISE NOTICE '  ✓ Added sims_per_month column';
  END IF;

  -- Add extension_boost if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'plan_entitlements'
    AND column_name = 'extension_boost'
  ) THEN
    ALTER TABLE public.plan_entitlements ADD COLUMN extension_boost jsonb NOT NULL DEFAULT '{}'::jsonb;
    RAISE NOTICE '  ✓ Added extension_boost column';
  END IF;
END $$;

\echo '  ✓ plan_entitlements columns fixed'
\echo ''

-- =====================================================
-- Fix 3: Seed/Update admin plan entitlements
-- =====================================================
\echo 'Fix 3: Ensuring admin plan entitlements exist...'

INSERT INTO public.plan_entitlements (
  plan_code,
  searches_per_month,
  ai_opportunities_per_month,
  niches_max,
  ai_calls_per_month,
  briefs_per_month,
  sims_per_month,
  extension_boost
) VALUES (
  'admin', -1, -1, -1, -1, -1, -1, '{}'::jsonb
)
ON CONFLICT (plan_code) DO UPDATE SET
  ai_calls_per_month = -1,
  briefs_per_month = -1,
  sims_per_month = -1,
  extension_boost = '{}'::jsonb;

\echo '  ✓ admin plan entitlements created/updated'
\echo ''

-- =====================================================
-- Verify fixes
-- =====================================================
\echo 'Verifying fixes...'
\echo ''

-- Show current plan entitlements
\echo 'Current plan entitlements:'
SELECT
  plan_code,
  ai_calls_per_month,
  briefs_per_month,
  sims_per_month
FROM public.plan_entitlements
ORDER BY
  CASE plan_code
    WHEN 'free' THEN 1
    WHEN 'basic' THEN 2
    WHEN 'pro' THEN 3
    WHEN 'growth' THEN 4
    WHEN 'admin' THEN 5
    ELSE 6
  END;

\echo ''
\echo '============================================'
\echo 'Fixes applied successfully!'
\echo '============================================'
\echo ''
\echo 'Remaining steps:'
\echo '1. Set LEXYBRAIN_KEY environment variable in production'
\echo '2. Verify LEXYBRAIN_MODEL_URL is correct'
\echo '3. Restart your application'
\echo ''

COMMIT;
