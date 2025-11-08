# Banner Notification Troubleshooting Guide

## Problem
Banner notification was created but not appearing. Console shows: `{banner: null}`

## Diagnostic Scripts

### 1. Quick Check (Start Here)
**File:** `scripts/quick-check.sql`

Run this first to see the current state:
- Lists all live banners
- Shows delivery records
- Tests the database function

```bash
# Copy and paste the contents into Supabase SQL Editor and run
```

### 2. Full Debug Report
**File:** `scripts/debug-banner.sql`

Comprehensive debugging that shows:
- All notifications in database
- Banner-specific notifications
- Tests the `get_active_banner_for_user` function
- Shows delivery records
- Manual query to verify what should be returned

### 3. Fix Banner (Run This!)
**File:** `scripts/fix-banner-status.sql`

**⚡ RUN THIS TO FIX THE ISSUE** - This script:
1. Checks current banner state
2. Fixes any status/schedule issues
3. Deletes blocking delivery records for 'all' audience
4. Verifies the fix worked
5. Tests with a real user

```bash
# Copy and paste into Supabase SQL Editor
# This will automatically fix common issues
```

## Common Issues and Fixes

### Issue 1: Notification Status Not 'live'
**Symptom:** Notification exists but has `status = 'draft'` or other status

**Fix:**
```sql
UPDATE notifications
SET status = 'live', published_at = NOW()
WHERE title LIKE '%Welcome to LexyHub%';
```

### Issue 2: Schedule Times Incorrect
**Symptom:** `schedule_start_at` is in the future or `schedule_end_at` is in the past

**Fix:**
```sql
UPDATE notifications
SET
  schedule_start_at = NOW(),
  schedule_end_at = NOW() + INTERVAL '30 days'
WHERE title LIKE '%Welcome to LexyHub%';
```

### Issue 3: Delivery Records Blocking Display
**Symptom:** Banner has `audience_scope = 'all'` but has delivery records with `state = 'dismissed'`

**Fix:**
```sql
-- For 'all' audience, we don't need delivery records
DELETE FROM notification_delivery
WHERE notification_id IN (
  SELECT id FROM notifications
  WHERE audience_scope = 'all' AND title LIKE '%Welcome%'
);
```

### Issue 4: show_banner = false
**Symptom:** Notification has `show_banner = false`

**Fix:**
```sql
UPDATE notifications
SET show_banner = true
WHERE title LIKE '%Welcome to LexyHub%';
```

## How the Banner System Works

### Database Function Requirements
The `get_active_banner_for_user(user_id)` function returns banners that meet ALL these criteria:

1. ✅ `status = 'live'`
2. ✅ `show_banner = true`
3. ✅ `schedule_start_at` is NULL or <= NOW()
4. ✅ `schedule_end_at` is NULL or > NOW()
5. ✅ No delivery record exists (for first-time display)
6. ✅ OR `show_once_per_user = false` (can show multiple times)
7. ✅ Not dismissed by the user

### Audience Scope = 'all'
When `audience_scope = 'all'`:
- Banner should show to ALL users
- Delivery records are NOT required
- If delivery records exist and have `state = 'dismissed'`, those specific users won't see it

## Manual Verification

### Check in Database
```sql
SELECT
  id, title, status, show_banner, audience_scope,
  schedule_start_at, schedule_end_at,
  NOW() as current_time
FROM notifications
WHERE title LIKE '%Welcome%'
ORDER BY created_at DESC LIMIT 1;
```

Expected output:
- `status` = 'live'
- `show_banner` = true
- `schedule_start_at` <= current_time
- `schedule_end_at` > current_time

### Test the API Endpoint
In your browser console:
```javascript
// Replace with your actual user ID
const userId = 'your-user-id-here';
fetch(`/api/notifications/active?userId=${userId}`)
  .then(r => r.json())
  .then(data => console.log('Banner:', data));
```

Expected output: Should show banner object, not `{banner: null}`

## Next Steps

1. **Run:** `scripts/fix-banner-status.sql` in Supabase SQL Editor
2. **Refresh:** Your browser
3. **Check:** Banner should now appear at the top of all pages
4. **Verify:** Also check the dashboard NotificationCard and notification feed

## Still Not Working?

If the banner still doesn't appear after running the fix script:

1. Check browser console for errors
2. Verify you're logged in (banner requires authentication)
3. Run `scripts/debug-banner.sql` and share the output
4. Check if you accidentally dismissed the banner (check notification_delivery table)
