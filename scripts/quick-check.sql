-- Quick check: What notifications exist and should be showing?

-- Check 1: What notifications are LIVE with show_banner=true?
SELECT
  'LIVE BANNERS IN DATABASE:' as check,
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
    WHEN schedule_start_at <= NOW() AND schedule_end_at > NOW() THEN '✅ In schedule window'
    WHEN schedule_start_at > NOW() THEN '❌ Not started yet'
    WHEN schedule_end_at <= NOW() THEN '❌ Already ended'
    ELSE '⚠️  Check schedule times'
  END as schedule_status
FROM notifications
WHERE status = 'live' AND show_banner = true
ORDER BY created_at DESC;

-- Check 2: Are there any delivery records blocking the banner?
SELECT
  'DELIVERY RECORDS:' as check,
  nd.notification_id,
  n.title,
  COUNT(*) as delivery_count,
  COUNT(CASE WHEN nd.state = 'dismissed' THEN 1 END) as dismissed_count
FROM notification_delivery nd
JOIN notifications n ON n.id = nd.notification_id
WHERE n.show_banner = true AND n.status = 'live'
GROUP BY nd.notification_id, n.title;

-- Check 3: Test the function directly (replace with your user ID if needed)
DO $$
DECLARE
  test_user_id uuid;
  banner_count integer;
BEGIN
  -- Get first user from auth.users
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users';
    RETURN;
  END IF;

  -- Test the function
  SELECT COUNT(*) INTO banner_count
  FROM public.get_active_banner_for_user(test_user_id);

  RAISE NOTICE 'Testing with user: %', test_user_id;
  RAISE NOTICE 'Function returned % banners', banner_count;

  IF banner_count = 0 THEN
    RAISE NOTICE '❌ Function returned NO banners';
  ELSE
    RAISE NOTICE '✅ Function returned a banner!';
  END IF;
END $$;
