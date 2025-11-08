-- Migration: Test Banner Notification
-- Description: Creates a test top bar notification to verify the banner system is working
-- This notification will be shown to all users

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
  'Welcome to LexyHub!',       -- title
  'Thank you for using LexyHub. We are constantly improving the platform to help you succeed.',  -- body
  'Get Started',               -- cta_text
  '/dashboard',                -- cta_url
  'info',                      -- severity: Info level (blue banner)
  80,                          -- priority: High priority
  'all',                       -- audience_scope: Show to all users
  NOW(),                       -- schedule_start_at: Start immediately
  (NOW() + INTERVAL '30 days')::timestamptz,  -- schedule_end_at: End in 30 days
  true,                        -- show_banner: Display in top bar
  true,                        -- create_inapp: Also show in notification feed
  false,                       -- send_email: No email for this
  'live',                      -- status: LIVE - will be shown immediately
  '👋'                        -- icon: Wave emoji
);
