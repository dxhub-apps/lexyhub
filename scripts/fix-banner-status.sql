-- ============================================================================
-- Fix Banner Notification Status
-- ============================================================================
-- This script checks and fixes any issues with the banner notification
-- ============================================================================

-- Step 1: Check current state
SELECT
  '===  CURRENT STATE ===' as section;

SELECT
  id,
  title,
  status,
  show_banner,
  audience_scope,
  show_once_per_user,
  schedule_start_at,
  schedule_end_at,
  NOW() as current_time
FROM notifications
WHERE title LIKE '%Welcome to LexyHub%'
  OR title LIKE '%Beta Test%'
ORDER BY created_at DESC
LIMIT 5;

-- Step 2: Fix any issues with the Welcome banner
UPDATE notifications
SET
  status = 'live',
  show_banner = true,
  audience_scope = 'all',
  show_once_per_user = false,
  schedule_start_at = CASE
    WHEN schedule_start_at IS NULL OR schedule_start_at > NOW()
    THEN NOW()
    ELSE schedule_start_at
  END,
  schedule_end_at = CASE
    WHEN schedule_end_at IS NULL OR schedule_end_at <= NOW()
    THEN NOW() + INTERVAL '30 days'
    ELSE schedule_end_at
  END,
  published_at = CASE
    WHEN published_at IS NULL
    THEN NOW()
    ELSE published_at
  END
WHERE title LIKE '%Welcome to LexyHub%'
  AND (
    status != 'live'
    OR show_banner != true
    OR schedule_start_at > NOW()
    OR schedule_end_at <= NOW()
  );

-- Step 3: Delete any blocking delivery records for 'all' audience scope
DELETE FROM notification_delivery
WHERE notification_id IN (
  SELECT id FROM notifications
  WHERE title LIKE '%Welcome to LexyHub%'
    AND audience_scope = 'all'
);

-- Step 4: Verify the fix
SELECT
  '=== AFTER FIX ===' as section;

SELECT
  id,
  title,
  status,
  show_banner,
  audience_scope,
  show_once_per_user,
  schedule_start_at,
  schedule_end_at,
  NOW() as current_time,
  CASE
    WHEN status = 'live'
      AND show_banner = true
      AND schedule_start_at <= NOW()
      AND schedule_end_at > NOW()
    THEN '✅ Should be visible'
    ELSE '❌ Won''t be visible'
  END as visibility_status
FROM notifications
WHERE title LIKE '%Welcome to LexyHub%'
ORDER BY created_at DESC
LIMIT 1;

-- Step 5: Test with a real user
DO $$
DECLARE
  test_user_id uuid;
  banner_record RECORD;
  banner_found boolean := false;
BEGIN
  -- Get first user
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '❌ No users in auth.users table';
    RETURN;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING WITH USER % ===', test_user_id;
  RAISE NOTICE '';

  -- Test the function
  FOR banner_record IN
    SELECT * FROM public.get_active_banner_for_user(test_user_id)
  LOOP
    RAISE NOTICE '✅ Banner FOUND!';
    RAISE NOTICE '   Title: %', banner_record.title;
    RAISE NOTICE '   ID: %', banner_record.id;
    RAISE NOTICE '   Severity: %', banner_record.severity;
    banner_found := true;
  END LOOP;

  IF NOT banner_found THEN
    RAISE NOTICE '❌ No banner returned - checking why...';

    -- Debug why it's not showing
    FOR banner_record IN
      SELECT
        n.id,
        n.title,
        n.status,
        n.show_banner,
        n.schedule_start_at,
        n.schedule_end_at,
        nd.state as delivery_state,
        nd.dismissed_at,
        n.show_once_per_user,
        NOW() as current_time
      FROM notifications n
      LEFT JOIN notification_delivery nd ON nd.notification_id = n.id AND nd.user_id = test_user_id
      WHERE n.title LIKE '%Welcome%'
      ORDER BY n.created_at DESC
      LIMIT 1
    LOOP
      RAISE NOTICE '';
      RAISE NOTICE 'Debug info for notification:';
      RAISE NOTICE '  Title: %', banner_record.title;
      RAISE NOTICE '  Status: % (should be ''live'')', banner_record.status;
      RAISE NOTICE '  show_banner: % (should be true)', banner_record.show_banner;
      RAISE NOTICE '  Schedule start: % (should be <= now)', banner_record.schedule_start_at;
      RAISE NOTICE '  Schedule end: % (should be > now)', banner_record.schedule_end_at;
      RAISE NOTICE '  Current time: %', banner_record.current_time;
      RAISE NOTICE '  Delivery state: % (should be null or not ''dismissed'')', banner_record.delivery_state;
      RAISE NOTICE '  show_once_per_user: % (should be false for recurring display)', banner_record.show_once_per_user;
    END LOOP;
  END IF;
END $$;
