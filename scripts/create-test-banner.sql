-- ============================================================================
-- Create Test Banner Notification
-- ============================================================================
-- This script creates a live banner notification that displays to all users
-- Run this in Supabase SQL Editor to activate the banner
-- ============================================================================

-- Step 1: Create the notification
DO $$
DECLARE
  new_notification_id uuid;
  start_time timestamptz := NOW();
  end_time timestamptz := NOW() + INTERVAL '30 days';
BEGIN
  -- Insert the test notification
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
    icon,
    audience_scope,
    audience_filter,
    schedule_start_at,
    schedule_end_at,
    recurrence,
    timezone,
    show_once_per_user,
    show_banner,
    create_inapp,
    send_email,
    status,
    published_at,
    meta
  ) VALUES (
    'banner',                    -- kind: Show as top bar banner
    'system',                    -- source: System notification
    'system',                    -- category: System category
    '👋 Welcome to LexyHub!',   -- title
    'Thank you for using LexyHub. We are constantly improving the platform to help you succeed.',  -- body
    'Get Started',               -- cta_text
    '/dashboard',                -- cta_url
    'info',                      -- severity: Info level (blue banner)
    80,                          -- priority: High priority (80/100)
    '👋',                        -- icon: Wave emoji
    'all',                       -- audience_scope: Show to all users
    '{}'::jsonb,                 -- audience_filter: Empty for 'all' scope
    start_time,                  -- schedule_start_at: Start immediately
    end_time,                    -- schedule_end_at: End in 30 days
    'none',                      -- recurrence: No recurrence
    'UTC',                       -- timezone
    false,                       -- show_once_per_user: Can see multiple times
    true,                        -- show_banner: Display in top bar ⭐
    true,                        -- create_inapp: Also show in notification feed
    false,                       -- send_email: No email
    'live',                      -- status: LIVE (will be shown immediately) ⭐
    NOW(),                       -- published_at: Published now
    '{}'::jsonb                  -- meta: Empty metadata
  )
  RETURNING id INTO new_notification_id;

  -- Output success message
  RAISE NOTICE '✅ Test banner notification created successfully!';
  RAISE NOTICE 'Notification ID: %', new_notification_id;
  RAISE NOTICE 'Status: live';
  RAISE NOTICE 'Audience: all users';
  RAISE NOTICE 'Duration: % to %', start_time, end_time;
  RAISE NOTICE '';
  RAISE NOTICE '🎉 The banner should now be visible in your app!';
  RAISE NOTICE 'Refresh your browser to see it.';
  RAISE NOTICE '';
  RAISE NOTICE '📍 The notification will appear in:';
  RAISE NOTICE '   - Top banner (all pages)';
  RAISE NOTICE '   - Dashboard notification card';
  RAISE NOTICE '   - Notification feed (bell icon)';

END $$;

-- Step 2: Verify the notification was created
SELECT
  id,
  title,
  status,
  show_banner,
  audience_scope,
  schedule_start_at,
  schedule_end_at,
  created_at
FROM notifications
WHERE title = '👋 Welcome to LexyHub!'
  AND status = 'live'
ORDER BY created_at DESC
LIMIT 1;
