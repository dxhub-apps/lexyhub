# Activate Test Banner Notification

## Issue
The TopBanner component was not displaying notifications because there were no notifications with `status = 'live'` in the database. The beta test notification exists but has `status = 'draft'`.

## Root Cause
The database function `get_active_banner_for_user` only returns notifications that meet these criteria:
- `status = 'live'` ⭐ (The beta test notification has `status = 'draft'`)
- `show_banner = true`
- Within the scheduled time window
- Not dismissed by the user

## Quick Fix Options

### ⚡ FASTEST: Run SQL Script (RECOMMENDED)
Copy and run this in **Supabase SQL Editor**:

```bash
# The file is at: scripts/create-test-banner.sql
```

This creates a live notification immediately - **no authentication needed!**

### 🔧 Option 2: Run TypeScript Script
If you have admin access and the app is running:

```bash
# Get your admin user ID from Supabase first
ADMIN_USER_ID=<your-admin-user-id> npx tsx scripts/create-test-banner.ts
```

### 📝 Option 3: Activate Beta Test Notification
To activate the existing beta test notification:

```sql
UPDATE notifications
SET
  status = 'live',
  audience_scope = 'all'
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
