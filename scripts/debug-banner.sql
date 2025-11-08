-- ============================================================================
-- Debug Banner Notification Issues
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose why banners aren't showing
-- ============================================================================

-- Step 1: Check all notifications in the database
SELECT
  '=== ALL NOTIFICATIONS ===' AS section;

SELECT
  id,
  title,
  kind,
  status,
  show_banner,
  audience_scope,
  schedule_start_at,
  schedule_end_at,
  created_at,
  CASE
    WHEN schedule_start_at IS NULL OR schedule_start_at <= NOW() THEN '✅ Started'
    ELSE '❌ Not started yet'
  END AS schedule_start_check,
  CASE
    WHEN schedule_end_at IS NULL OR schedule_end_at > NOW() THEN '✅ Not ended'
    ELSE '❌ Already ended'
  END AS schedule_end_check
FROM notifications
ORDER BY created_at DESC
LIMIT 10;

-- Step 2: Check specifically for banner notifications that should be live
SELECT
  '=== BANNER NOTIFICATIONS (SHOULD BE VISIBLE) ===' AS section;

SELECT
  id,
  title,
  status,
  show_banner,
  audience_scope,
  priority,
  schedule_start_at,
  schedule_end_at,
  NOW() AS current_time
FROM notifications
WHERE status = 'live'
  AND show_banner = true
  AND (schedule_start_at IS NULL OR schedule_start_at <= NOW())
  AND (schedule_end_at IS NULL OR schedule_end_at > NOW())
ORDER BY priority DESC, created_at DESC;

-- Step 3: Test the database function with a sample user ID
-- Replace 'YOUR_USER_ID' with an actual user ID from your auth.users table
SELECT
  '=== TESTING get_active_banner_for_user FUNCTION ===' AS section;

-- First, let's get a sample user ID
DO $$
DECLARE
  sample_user_id uuid;
  banner_result RECORD;
BEGIN
  -- Get the first user ID from auth.users
  SELECT id INTO sample_user_id
  FROM auth.users
  LIMIT 1;

  IF sample_user_id IS NULL THEN
    RAISE NOTICE '❌ No users found in auth.users table';
    RETURN;
  END IF;

  RAISE NOTICE '🔍 Testing with user ID: %', sample_user_id;

  -- Test the function
  FOR banner_result IN
    SELECT * FROM public.get_active_banner_for_user(sample_user_id)
  LOOP
    RAISE NOTICE '✅ Banner found:';
    RAISE NOTICE '   ID: %', banner_result.id;
    RAISE NOTICE '   Title: %', banner_result.title;
    RAISE NOTICE '   Severity: %', banner_result.severity;
    RAISE NOTICE '   Priority: %', banner_result.priority;
    RETURN;
  END LOOP;

  RAISE NOTICE '❌ No banner returned by get_active_banner_for_user()';
END $$;

-- Step 4: Check for any delivery records that might be blocking the banner
SELECT
  '=== DELIVERY RECORDS (MIGHT BLOCK BANNER) ===' AS section;

SELECT
  nd.notification_id,
  n.title,
  nd.user_id,
  nd.state,
  nd.dismissed_at,
  nd.attempts,
  n.show_once_per_user,
  n.max_impressions_per_user
FROM notification_delivery nd
JOIN notifications n ON n.id = nd.notification_id
WHERE n.show_banner = true
  AND n.status = 'live'
ORDER BY nd.created_at DESC
LIMIT 20;

-- Step 5: Check the database function definition
SELECT
  '=== CHECKING FUNCTION DEFINITION ===' AS section;

SELECT
  pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname = 'get_active_banner_for_user';

-- Step 6: Manual query to see what the function should return
SELECT
  '=== MANUAL QUERY (WHAT FUNCTION SHOULD RETURN) ===' AS section;

-- This is what the function does internally - run it manually to debug
SELECT
  n.id,
  n.title,
  n.body,
  n.cta_text,
  n.cta_url,
  n.severity,
  n.priority,
  n.icon,
  n.status,
  n.show_banner,
  n.schedule_start_at,
  n.schedule_end_at,
  NOW() as current_time
FROM public.notifications n
WHERE
  n.status = 'live'
  AND n.show_banner = true
  AND (n.schedule_start_at IS NULL OR n.schedule_start_at <= NOW())
  AND (n.schedule_end_at IS NULL OR n.schedule_end_at > NOW())
ORDER BY
  n.priority DESC,
  n.schedule_start_at ASC,
  n.created_at DESC
LIMIT 5;
