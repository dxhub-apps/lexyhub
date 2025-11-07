-- =====================================================
-- LexyBrain Database Verification Script
-- =====================================================
-- This script checks if migration 0037 has been properly applied
-- and provides diagnostic information for troubleshooting
-- =====================================================

\echo '============================================'
\echo 'LexyBrain Database Verification'
\echo '============================================'
\echo ''

-- Check 1: Verify ai_usage_events table exists with ts column
\echo 'Check 1: Verifying ai_usage_events table schema...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ai_usage_events'
        AND column_name = 'ts'
    ) THEN '✓ PASS: ai_usage_events.ts column exists'
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ai_usage_events'
    ) THEN '✗ FAIL: ai_usage_events table exists but missing ts column'
    ELSE '✗ FAIL: ai_usage_events table does not exist'
  END AS status;

\echo ''

-- Check 2: Verify ai_insights cache table exists
\echo 'Check 2: Verifying ai_insights cache table...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ai_insights'
    ) THEN '✓ PASS: ai_insights table exists'
    ELSE '✗ FAIL: ai_insights table does not exist'
  END AS status;

\echo ''

-- Check 3: Verify ai_failures logging table exists
\echo 'Check 3: Verifying ai_failures logging table...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'ai_failures'
    ) THEN '✓ PASS: ai_failures table exists'
    ELSE '✗ FAIL: ai_failures table does not exist'
  END AS status;

\echo ''

-- Check 4: Verify plan_entitlements has LexyBrain columns
\echo 'Check 4: Verifying plan_entitlements has LexyBrain columns...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_entitlements'
        AND column_name = 'ai_calls_per_month'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_entitlements'
        AND column_name = 'briefs_per_month'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'plan_entitlements'
        AND column_name = 'sims_per_month'
    ) THEN '✓ PASS: plan_entitlements has all LexyBrain columns'
    ELSE '✗ FAIL: plan_entitlements missing LexyBrain columns'
  END AS status;

\echo ''

-- Check 5: Verify admin plan entitlements exist
\echo 'Check 5: Verifying admin plan entitlements...'
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM public.plan_entitlements
      WHERE plan_code = 'admin'
    ) THEN '✓ PASS: admin plan exists in plan_entitlements'
    ELSE '✗ FAIL: admin plan does not exist in plan_entitlements'
  END AS status;

\echo ''

-- Check 6: Show current plan entitlements (if table exists)
\echo 'Check 6: Current plan entitlements:'
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
\echo 'Verification Complete'
\echo '============================================'
\echo ''
\echo 'If any checks failed, run migration 0037:'
\echo '  supabase db push'
\echo 'Or manually apply:'
\echo '  psql $DATABASE_URL < supabase/migrations/0037_lexybrain_core_tables.sql'
\echo ''
