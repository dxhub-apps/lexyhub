# Activate Test Banner Notification

## Issue
The TopBanner component was not displaying notifications because there were no notifications with `status = 'live'` in the database. The beta test notification exists but has `status = 'draft'`.

## Root Cause
The database function `get_active_banner_for_user` only returns notifications that meet these criteria:
- `status = 'live'`
- `show_banner = true`
- Within the scheduled time window
- Not dismissed by the user

## Solution
A test notification migration has been created at:
`supabase/migrations/0042_test_banner_notification.sql`

This migration creates a "Welcome to LexyHub!" notification that:
- Shows to ALL users (`audience_scope = 'all'`)
- Is immediately LIVE (`status = 'live'`)
- Displays in the top banner (`show_banner = true`)
- Lasts for 30 days from activation
- Uses info severity (blue banner)

## How to Activate

### Option 1: Run the Migration (Recommended)
If you have access to the Supabase dashboard or CLI:

```bash
# Using Supabase CLI (if installed)
supabase db push

# Or manually in Supabase SQL Editor
# Copy the contents of supabase/migrations/0042_test_banner_notification.sql
# and run it in the SQL Editor
```

### Option 2: Manual SQL Execution
Connect to your Supabase database and run:

```sql
INSERT INTO notifications (
  kind, source, category, title, body,
  cta_text, cta_url, severity, priority,
  audience_scope, schedule_start_at, schedule_end_at,
  show_banner, create_inapp, send_email, status, icon
) VALUES (
  'banner', 'system', 'system',
  'Welcome to LexyHub!',
  'Thank you for using LexyHub. We are constantly improving the platform to help you succeed.',
  'Get Started', '/dashboard', 'info', 80,
  'all', NOW(), (NOW() + INTERVAL '30 days')::timestamptz,
  true, true, false, 'live', '👋'
);
```

### Option 3: Activate the Beta Test Notification
If you want to activate the existing beta test notification instead:

```sql
UPDATE notifications
SET
  status = 'live',
  audience_scope = 'all'  -- Or keep 'user_ids' and populate the user_ids array
WHERE title = '🎯 Beta Test Program'
  AND category = 'system';
```

## Verification
After running the migration:

1. Refresh the application
2. The banner should appear at the top of all pages (between the Topbar and main content)
3. The notification should also appear:
   - In the NotificationCard on the Dashboard page
   - In the notification feed (bell icon)

## Troubleshooting
If the banner still doesn't show:

1. Check browser console for errors
2. Verify the notification was created:
   ```sql
   SELECT id, title, status, show_banner, schedule_start_at, schedule_end_at
   FROM notifications
   WHERE status = 'live' AND show_banner = true;
   ```
3. Check if the notification appears in the API response:
   ```
   /api/notifications/active?userId=<your-user-id>
   ```

## Components Modified
- `src/components/layout/AppShell.tsx` - TopBanner is displayed here
- `src/components/notifications/TopBanner.tsx` - Banner component
- `src/components/notifications/NotificationCard.tsx` - Dashboard card component
- `src/app/(app)/dashboard/page.tsx` - Dashboard page with NotificationCard
