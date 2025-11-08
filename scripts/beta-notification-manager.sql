-- Beta Test Notification Management Script
-- This script helps manage the beta test influencer notification

-- ============================================================================
-- STEP 1: View the notification details
-- ============================================================================
SELECT
  id,
  title,
  body,
  status,
  schedule_start_at,
  schedule_end_at,
  audience_scope,
  audience_filter,
  created_at
FROM notifications
WHERE title = '🎯 Beta Test Program'
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- STEP 2: Update with the 20 influencer user IDs
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Replace the placeholder UUIDs below with the actual user IDs of the 20 influencers
-- 2. You can get user IDs from the user_profiles table using email or other criteria
-- 3. After updating the user_ids array, uncomment and run this UPDATE statement

/*
UPDATE notifications
SET
  audience_filter = jsonb_build_object(
    'user_ids', ARRAY[
      '00000000-0000-0000-0000-000000000001'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000002'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000003'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000004'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000005'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000006'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000007'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000008'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000009'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000010'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000011'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000012'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000013'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000014'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000015'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000016'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000017'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000018'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000019'::uuid,  -- Replace with actual user ID
      '00000000-0000-0000-0000-000000000020'::uuid   -- Replace with actual user ID
    ]
  ),
  status = 'live',  -- Activate the notification
  updated_at = NOW()
WHERE title = '🎯 Beta Test Program'
  AND category = 'system'
  AND status = 'draft';  -- Only update if still in draft
*/

-- ============================================================================
-- HELPER QUERY: Find users by email (if you have a list of influencer emails)
-- ============================================================================
-- Example: Find user IDs for specific email addresses
/*
SELECT
  id,
  email,
  full_name,
  plan
FROM user_profiles
WHERE email IN (
  'influencer1@example.com',
  'influencer2@example.com'
  -- Add more emails as needed
)
ORDER BY email;
*/

-- ============================================================================
-- HELPER QUERY: Find users by other criteria
-- ============================================================================
-- Example: Find users by plan or other attributes
/*
SELECT
  id,
  email,
  full_name,
  plan,
  created_at
FROM user_profiles
WHERE plan = 'growth'  -- or other criteria
ORDER BY created_at DESC
LIMIT 20;
*/

-- ============================================================================
-- STEP 3: Create delivery records for the 20 influencers
-- ============================================================================
-- After updating the notification with user IDs and setting status to 'live',
-- run this to create the delivery records:

/*
DO $$
DECLARE
  v_notification_id uuid;
  v_user_id uuid;
  v_user_ids uuid[];
BEGIN
  -- Get the notification ID and user IDs
  SELECT id, (audience_filter->>'user_ids')::uuid[]
  INTO v_notification_id, v_user_ids
  FROM notifications
  WHERE title = '🎯 Beta Test Program'
    AND status = 'live'
  LIMIT 1;

  -- Create delivery records for each user
  FOREACH v_user_id IN ARRAY v_user_ids
  LOOP
    INSERT INTO notification_delivery (
      notification_id,
      user_id,
      state,
      channels,
      created_at
    ) VALUES (
      v_notification_id,
      v_user_id,
      'pending',
      ARRAY['banner', 'inapp'],
      NOW()
    )
    ON CONFLICT (notification_id, user_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created delivery records for % users', array_length(v_user_ids, 1);
END $$;
*/

-- ============================================================================
-- STEP 4: Verify the notification is active
-- ============================================================================
-- Check that the notification is live and has delivery records
/*
SELECT
  n.id,
  n.title,
  n.status,
  COUNT(nd.id) as delivery_records,
  COUNT(CASE WHEN nd.state = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN nd.state = 'shown' THEN 1 END) as shown,
  COUNT(CASE WHEN nd.state = 'dismissed' THEN 1 END) as dismissed
FROM notifications n
LEFT JOIN notification_delivery nd ON nd.notification_id = n.id
WHERE n.title = '🎯 Beta Test Program'
GROUP BY n.id, n.title, n.status;
*/

-- ============================================================================
-- OPTIONAL: Pause or end the notification early
-- ============================================================================
-- To pause the notification:
-- UPDATE notifications SET status = 'paused' WHERE title = '🎯 Beta Test Program';

-- To end the notification:
-- UPDATE notifications SET status = 'ended', schedule_end_at = NOW() WHERE title = '🎯 Beta Test Program';
