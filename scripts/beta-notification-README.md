# Beta Test Influencer Notification Setup

This directory contains scripts and migrations to set up a top bar notification for the 20 beta test influencers. The notification will display until December 25, 2025.

## 📋 Overview

The notification system will:
- Display a blue banner at the top of the application
- Target 20 specific influencer users
- Show the message: "You're part of our exclusive Beta Test program! Thank you for helping us improve the platform."
- Remain active until December 25, 2025
- Also appear in the in-app notification feed

## 🚀 Quick Start

### Step 1: Apply the Migration

The migration creates the notification record in the database. You have two options:

**Option A: Using Supabase CLI (Recommended)**
```bash
supabase migration up
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/0041_beta_test_influencer_notification.sql`
4. Click "Run"

**Option C: Using psql (Direct Database Access)**
```bash
psql $DATABASE_URL -f supabase/migrations/0041_beta_test_influencer_notification.sql
```

### Step 2: Get the 20 Influencer User IDs

You need to identify which 20 users should receive the beta notification. Here are some ways to find them:

**Option A: If you have their email addresses**
```sql
SELECT id, email, full_name, plan, created_at
FROM user_profiles
WHERE email IN (
  'influencer1@example.com',
  'influencer2@example.com',
  -- add more emails
)
ORDER BY email;
```

**Option B: If you want to select by criteria (e.g., most active users)**
```sql
-- Example: Get 20 most active users on growth/scale plans
SELECT id, email, full_name, plan, created_at
FROM user_profiles
WHERE plan IN ('growth', 'scale')
  AND created_at >= NOW() - INTERVAL '90 days'
ORDER BY created_at ASC
LIMIT 20;
```

**Option C: Manual selection from admin dashboard**
Navigate to your user management interface and select the 20 influencers.

### Step 3: Activate the Notification

Once you have the 20 user IDs, use the TypeScript activation script:

1. **Edit the activation script:**
   ```bash
   code scripts/activate-beta-notification.ts
   ```

2. **Replace the INFLUENCER_USER_IDS array** with your actual user IDs:
   ```typescript
   const INFLUENCER_USER_IDS: string[] = [
     'uuid-of-user-1',
     'uuid-of-user-2',
     'uuid-of-user-3',
     // ... add all 20 user IDs
   ];
   ```

3. **Run the activation script:**
   ```bash
   npx tsx scripts/activate-beta-notification.ts
   ```

   The script will:
   - ✅ Verify all 20 users exist
   - ✅ Update the notification with the user IDs
   - ✅ Change status from 'draft' to 'live'
   - ✅ Create delivery records for each user
   - ✅ Verify the setup

### Step 4 (Alternative): Activate via SQL

If you prefer to use SQL directly, you can use the management script:

1. **Edit `scripts/beta-notification-manager.sql`**
2. **Update the user IDs in the UPDATE statement**
3. **Uncomment and run the UPDATE statement**
4. **Uncomment and run the delivery record creation block**

## 📊 Verify the Notification

After activation, verify everything is working:

```sql
-- Check notification status
SELECT
  n.id,
  n.title,
  n.status,
  n.schedule_end_at,
  COUNT(nd.id) as total_deliveries,
  COUNT(CASE WHEN nd.state = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN nd.state = 'shown' THEN 1 END) as shown
FROM notifications n
LEFT JOIN notification_delivery nd ON nd.notification_id = n.id
WHERE n.title = '🎯 Beta Test Program'
GROUP BY n.id, n.title, n.status, n.schedule_end_at;
```

Expected result:
- Status: `live`
- Total deliveries: `20`
- Pending: `20` (initially, will decrease as users see it)
- Schedule end: `2025-12-25 23:59:59+00`

## 🎨 What Users Will See

### Top Bar Banner
- **Location:** Fixed at the top of the application
- **Color:** Blue (info severity)
- **Icon:** 🎯
- **Title:** "Beta Test Program"
- **Message:** "You're part of our exclusive Beta Test program! Thank you for helping us improve the platform. This beta version will be active until December 25, 2025."
- **Action Button:** "Learn More" (links to `/beta-info`)

### Notification Feed
The notification will also appear in:
- The notification bell dropdown (top right)
- The unread notifications tab
- With a blue dot indicator if unread

## 🔧 Managing the Notification

### Pause the Notification Temporarily
```sql
UPDATE notifications
SET status = 'paused'
WHERE title = '🎯 Beta Test Program';
```

### Resume the Notification
```sql
UPDATE notifications
SET status = 'live'
WHERE title = '🎯 Beta Test Program';
```

### End the Notification Early
```sql
UPDATE notifications
SET status = 'ended', schedule_end_at = NOW()
WHERE title = '🎯 Beta Test Program';
```

### Update the Message
```sql
UPDATE notifications
SET
  body = 'Your new message here',
  updated_at = NOW()
WHERE title = '🎯 Beta Test Program';
```

### Change the End Date
```sql
UPDATE notifications
SET
  schedule_end_at = '2025-12-31 23:59:59+00'::timestamptz,
  updated_at = NOW()
WHERE title = '🎯 Beta Test Program';
```

## 📈 Track Engagement

Monitor how users interact with the notification:

```sql
SELECT
  nd.state,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM notification_delivery nd
JOIN notifications n ON n.id = nd.notification_id
WHERE n.title = '🎯 Beta Test Program'
GROUP BY nd.state
ORDER BY count DESC;
```

View detailed user engagement:
```sql
SELECT
  up.email,
  up.full_name,
  nd.state,
  nd.first_seen_at,
  nd.last_seen_at,
  nd.clicked_at,
  nd.dismissed_at
FROM notification_delivery nd
JOIN notifications n ON n.id = nd.notification_id
JOIN user_profiles up ON up.id = nd.user_id
WHERE n.title = '🎯 Beta Test Program'
ORDER BY nd.first_seen_at DESC NULLS LAST;
```

## 🐛 Troubleshooting

### Users don't see the notification
1. **Check notification status:**
   ```sql
   SELECT status FROM notifications WHERE title = '🎯 Beta Test Program';
   ```
   Should be `live`, not `draft`, `paused`, or `ended`.

2. **Check delivery records exist:**
   ```sql
   SELECT COUNT(*) FROM notification_delivery nd
   JOIN notifications n ON n.id = nd.notification_id
   WHERE n.title = '🎯 Beta Test Program';
   ```
   Should return `20`.

3. **Check user IDs are correct:**
   ```sql
   SELECT audience_filter FROM notifications
   WHERE title = '🎯 Beta Test Program';
   ```
   Verify the `user_ids` array contains the correct UUIDs.

4. **Check schedule is active:**
   ```sql
   SELECT schedule_start_at, schedule_end_at, NOW()
   FROM notifications
   WHERE title = '🎯 Beta Test Program';
   ```
   Current time should be between start and end dates.

### Notification shows to wrong users
1. Verify the `audience_filter.user_ids` array
2. Check if delivery records were created for correct users
3. If needed, delete incorrect delivery records:
   ```sql
   DELETE FROM notification_delivery
   WHERE notification_id = (
     SELECT id FROM notifications WHERE title = '🎯 Beta Test Program'
   )
   AND user_id NOT IN ('correct-uuid-1', 'correct-uuid-2', ...);
   ```

### Need to reset and start over
```sql
-- Delete delivery records
DELETE FROM notification_delivery
WHERE notification_id = (SELECT id FROM notifications WHERE title = '🎯 Beta Test Program');

-- Reset notification to draft
UPDATE notifications
SET status = 'draft', audience_filter = '{"user_ids": []}'::jsonb
WHERE title = '🎯 Beta Test Program';

-- Then re-run the activation script
```

## 📝 Files Reference

- **`supabase/migrations/0041_beta_test_influencer_notification.sql`**
  - Creates the notification record in the database
  - Sets up the notification as a draft with placeholder configuration

- **`scripts/activate-beta-notification.ts`**
  - TypeScript script to activate the notification with user IDs
  - Validates users exist
  - Creates delivery records
  - Verifies setup

- **`scripts/beta-notification-manager.sql`**
  - SQL queries for managing the notification
  - Helper queries for finding users
  - Verification queries
  - Management commands

- **`scripts/beta-notification-README.md`** (this file)
  - Complete documentation
  - Step-by-step instructions
  - Troubleshooting guide

## 🎯 Summary

After following these steps, the 20 influencers will see:
1. A blue banner at the top of their application
2. The banner will say they're part of the Beta Test program
3. The banner will remain until December 25, 2025
4. They can dismiss it, but it will reappear until the end date
5. They can click "Learn More" to get additional information

The notification respects user preferences and can be tracked, paused, or ended at any time through the admin interface or SQL commands.
