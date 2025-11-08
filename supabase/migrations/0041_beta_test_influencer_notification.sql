-- Migration: Beta Test Influencer Top Bar Notification
-- Description: Creates a top bar notification for 20 influencers indicating beta test status
-- Due Date: December 25, 2025

-- Insert the beta test notification
INSERT INTO notifications (
  kind,
  source,
  category,
  title,
  body,
  cta_text,
  cta_url,
  severity,
  priority,
  audience_scope,
  audience_filter,
  schedule_start_at,
  schedule_end_at,
  show_banner,
  create_inapp,
  send_email,
  status,
  icon
) VALUES (
  'banner',                    -- kind: Show as top bar banner
  'system',                    -- source: System notification
  'system',                    -- category: System category
  '🎯 Beta Test Program',     -- title: Clear beta indicator
  'You''re part of our exclusive Beta Test program! Thank you for helping us improve the platform. This beta version will be active until December 25, 2025.',  -- body
  'Learn More',               -- cta_text
  '/beta-info',               -- cta_url: Can be updated to actual beta info page
  'info',                     -- severity: Info level (blue banner)
  90,                         -- priority: High priority (90/100)
  'user_ids',                 -- audience_scope: Target specific users
  jsonb_build_object(
    'user_ids', ARRAY[]::uuid[],  -- TODO: Add the 20 influencer user IDs here
    'comment', 'Update this array with the 20 beta test influencer user IDs before publishing'
  ),
  NOW(),                      -- schedule_start_at: Start immediately
  '2025-12-25 23:59:59+00'::timestamptz,  -- schedule_end_at: End on Dec 25, 2025
  true,                       -- show_banner: Display in top bar
  true,                       -- create_inapp: Also show in notification feed
  false,                      -- send_email: No email for this
  'draft',                    -- status: Start as draft until user IDs are added
  '🚀'                        -- icon: Rocket emoji for beta/launch
);

-- Get the notification ID for reference
DO $$
DECLARE
  notification_id uuid;
BEGIN
  SELECT id INTO notification_id
  FROM notifications
  WHERE title = '🎯 Beta Test Program'
    AND category = 'system'
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE NOTICE 'Beta test notification created with ID: %', notification_id;
  RAISE NOTICE 'To activate this notification:';
  RAISE NOTICE '1. Update the audience_filter.user_ids array with the 20 influencer user IDs';
  RAISE NOTICE '2. Change status from ''draft'' to ''live''';
  RAISE NOTICE '3. Or use the publish API endpoint to automatically create delivery records';
END $$;

-- Example query to update with specific user IDs (uncomment and modify when ready):
-- UPDATE notifications
-- SET
--   audience_filter = jsonb_build_object(
--     'user_ids', ARRAY[
--       'user-id-1'::uuid,
--       'user-id-2'::uuid,
--       'user-id-3'::uuid
--       -- ... add all 20 user IDs
--     ]
--   ),
--   status = 'live'
-- WHERE title = '🎯 Beta Test Program'
--   AND category = 'system';
