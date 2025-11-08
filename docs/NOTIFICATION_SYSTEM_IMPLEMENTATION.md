# Lexyhub Notification System - Implementation Guide

## Overview

This document provides a comprehensive guide to the Lexyhub notification system implementation. The backend infrastructure is complete, and this guide covers what has been implemented, what remains to be done, and how to complete the system.

---

## ✅ What Has Been Implemented

### 1. Database Layer

**File:** `/supabase/migrations/0029_notification_system.sql`

**Tables Created:**
- `notification_segments` - Reusable audience definitions
- `notifications` - Central notification definitions
- `notification_delivery` - Per-user delivery tracking
- `user_notification_prefs` - User preferences per category

**Database Functions:**
- `get_active_banner_for_user(user_id)` - Priority-based banner resolution
- `get_unread_notification_count(user_id)` - Count unread notifications
- `mark_notification_read(notification_id, user_id)` - Mark as read
- `track_notification_action(notification_id, user_id, action)` - Track clicks/dismissals

**Row Level Security:**
- Admins: Full CRUD access to all tables
- Users: Read their own delivery records and preferences
- Segments/Notifications: Admin-only access

### 2. Backend Services

**Location:** `/src/lib/notifications/`

**Files Created:**
- `types.ts` - Complete TypeScript type definitions
- `service.ts` - Core CRUD operations for notifications and segments
- `delivery.ts` - Delivery tracking and feed retrieval
- `targeting.ts` - Audience filtering and user matching
- `preferences.ts` - User preference management
- `email.ts` - Resend integration with email templates
- `index.ts` - Main exports

**Key Features:**
- Full notification lifecycle management (create, update, publish, pause, end, delete)
- Advanced audience targeting with filters (plan, extension, quota usage, activity, markets)
- Delivery state tracking (pending, shown, clicked, dismissed, emailed, failed)
- User preference management per category and channel
- Email template system with 5 built-in templates
- Metrics and analytics

### 3. Public API Routes

**Base:** `/src/app/api/notifications/`

**Endpoints:**
- `GET /api/notifications/active` - Get active banner for user
- `GET /api/notifications/feed` - Get paginated notification feed with unread count
- `POST /api/notifications/delivery` - Track delivery actions (view, click, dismiss, mark_all_read)
- `GET /api/notifications/prefs` - Get user preferences
- `PATCH /api/notifications/prefs` - Update user preferences

### 4. Admin/Backoffice API Routes

**Base:** `/src/app/api/admin/backoffice/`

**Notification Management:**
- `GET /api/admin/backoffice/notifications` - List with filters
- `POST /api/admin/backoffice/notifications` - Create notification
- `GET /api/admin/backoffice/notifications/[id]` - Get by ID
- `PATCH /api/admin/backoffice/notifications/[id]` - Update
- `DELETE /api/admin/backoffice/notifications/[id]` - Delete (soft)
- `POST /api/admin/backoffice/notifications/[id]/publish` - Publish and create delivery records
- `POST /api/admin/backoffice/notifications/[id]/pause` - Pause
- `POST /api/admin/backoffice/notifications/[id]/end` - End
- `POST /api/admin/backoffice/notifications/[id]/test-send` - Send test email
- `GET /api/admin/backoffice/notifications/[id]/metrics` - Get analytics

**Segment Management:**
- `GET /api/admin/backoffice/segments` - List segments
- `POST /api/admin/backoffice/segments` - Create segment

---

## 📋 What Needs to Be Completed

### 1. Package Dependencies

**Required:**
```bash
npm install resend
```

**Update:** `/package.json`
```json
{
  "dependencies": {
    "resend": "^2.0.0",
    // ... existing dependencies
  }
}
```

### 2. Environment Variables

**Add to:** `.env` / `.env.local`
```env
# Resend Email Service
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=notifications@lexyhub.com

By default, notification emails will use **LexyHub** as the sender name. You can override this by updating the
`DEFAULT_FROM_NAME` constant in `src/lib/notifications/email.ts` if a different branding is required.

# App URL for email links
NEXT_PUBLIC_APP_URL=https://lexyhub.com
```

**Get Resend API Key:**
1. Sign up at https://resend.com
2. Verify your sending domain
3. Generate API key
4. Add to environment variables

### 3. Database Migration

**Run the migration:**
```bash
# Option 1: Using Supabase CLI
supabase db push

# Option 2: Using Supabase Dashboard
# 1. Go to SQL Editor in Supabase Dashboard
# 2. Copy contents of /supabase/migrations/0029_notification_system.sql
# 3. Run the migration
```

**Verify Migration:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'notification%';

-- Should return:
-- notification_segments
-- notifications
-- notification_delivery
-- user_notification_prefs
```

### 4. Frontend Components

The following React components need to be created:

#### A. TopBanner Component

**File:** `/src/components/notifications/TopBanner.tsx`

**Requirements:**
- Fetches active banner via `/api/notifications/active`
- Displays at top of app (above main content)
- Shows: icon, title, body, CTA button, dismiss button
- Severity-based styling (info=blue, success=green, warning=yellow, critical=red)
- Auto-fetch every 5 minutes
- Track view/click/dismiss via `/api/notifications/delivery`
- Hidden when no active banner
- Uses Framer Motion for slide-in animation

**Integration Point:** `src/app/(app)/layout.tsx`

#### B. NotificationBell Component

**File:** `/src/components/notifications/NotificationBell.tsx`

**Requirements:**
- Bell icon with unread count badge
- Click opens NotificationFeed in dropdown/modal
- Fetches unread count via `/api/notifications/feed?unread=true`
- Real-time updates (polling every 30s or Supabase Realtime)
- Uses Radix UI Popover

**Integration Point:** `src/components/layout/Topbar.tsx`

#### C. NotificationFeed Component

**File:** `/src/components/notifications/NotificationFeed.tsx`

**Requirements:**
- Tabbed interface: "Unread" / "All"
- Infinite scroll or pagination
- Each item shows: icon, title, timestamp, read/unread indicator
- Click item to mark as read and follow CTA
- "Mark all as read" button
- Empty state when no notifications
- Uses `/api/notifications/feed`

#### D. NotificationPreferences Page

**File:** `/src/app/(app)/settings/notifications/page.tsx`

**Requirements:**
- Table/grid of categories (keyword, watchlist, ai, account, system, collab)
- Toggle switches for in-app and email per category
- Email frequency dropdown (instant, daily, weekly, disabled) per category
- Disable email toggle for critical categories (account, system)
- Save button with loading state
- Uses `/api/notifications/prefs`

**Route:** `/settings/notifications`

#### E. Admin Console - List Page

**File:** `/src/app/(app)/admin/backoffice/notifications/page.tsx`

**Requirements:**
- Data table with columns:
  - Title
  - Kind (badge)
  - Severity (colored badge)
  - Status (badge)
  - Category
  - Channels (show_banner, create_inapp, send_email icons)
  - Schedule (start/end)
  - Created at
  - Actions (edit, pause/resume, end, delete)
- Filters:
  - Status dropdown
  - Kind dropdown
  - Severity dropdown
  - Category dropdown
  - Search by title/body
- "Create Notification" button
- Bulk actions (pause, end)
- Pagination
- Uses `/api/admin/backoffice/notifications`

**Route:** `/admin/backoffice/notifications`

#### F. Admin Console - Create/Edit Form

**File:** `/src/app/(app)/admin/backoffice/notifications/[id]/page.tsx`

**Requirements:**
- Multi-tab form:
  - **Content Tab:**
    - Title (required)
    - Body (rich text optional)
    - CTA text + URL
    - Severity radio buttons
    - Priority slider (0-100)
    - Icon picker/input
  - **Audience Tab:**
    - Scope selector (all, plan, user_ids, segment, workspace)
    - Conditional filters based on scope:
      - Plan: Multi-select plan codes
      - User IDs: Textarea with UUID list
      - Segment: Dropdown of segments
    - Advanced filters:
      - Has extension toggle
      - Watched markets multi-select
      - Quota usage range
      - Activity recency
  - **Schedule Tab:**
    - Start date/time
    - End date/time (optional)
    - Recurrence (none, daily, weekly)
    - Timezone selector
    - Show once per user toggle
    - Max impressions per user input
  - **Channels Tab:**
    - Show banner toggle
    - Create in-app toggle
    - Send email toggle
    - Email template selector (conditional on send_email)
    - Preview panes for each channel
- Actions:
  - Save as draft
  - Publish (with confirmation)
  - Test send (email)
  - Pause/Resume
  - End
  - Delete
- Validation
- Uses `/api/admin/backoffice/notifications` and action endpoints

**Routes:**
- `/admin/backoffice/notifications/new`
- `/admin/backoffice/notifications/[id]`

#### G. Admin Console - Analytics Dashboard

**File:** `/src/app/(app)/admin/backoffice/notifications/[id]/analytics/page.tsx`

**Requirements:**
- Summary cards:
  - Total impressions
  - Click-through rate
  - Dismiss rate
  - Email open rate
  - Email click rate
- Time series chart (impressions, clicks over time)
- Delivery records table:
  - User email
  - Channels delivered
  - State
  - Timestamps
  - Actions
- Export to CSV button
- Uses `/api/admin/backoffice/notifications/[id]/metrics`

**Route:** `/admin/backoffice/notifications/[id]/analytics`

### 5. Background Jobs (Optional Phase 2)

**Location:** `/jobs/notifications/`

**Jobs to Create:**
- `digest-aggregator.ts` - Aggregate daily/weekly digests
- `scheduled-publisher.ts` - Publish scheduled notifications
- `delivery-retry.ts` - Retry failed email deliveries
- `cleanup.ts` - Purge old records (90 days)

**Scheduling:** Use Vercel Cron or GitHub Actions

### 6. Real-time Updates (Optional Phase 2)

**Approach 1: Supabase Realtime**
```typescript
// Subscribe to new notifications
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notification_delivery',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    // Update UI with new notification
  })
  .subscribe();
```

**Approach 2: Polling**
- Poll `/api/notifications/feed?unread=true` every 30 seconds
- Compare unread count to trigger UI updates

### 7. Testing

**Unit Tests:**
- `src/lib/notifications/__tests__/service.test.ts`
- `src/lib/notifications/__tests__/targeting.test.ts`
- `src/lib/notifications/__tests__/preferences.test.ts`

**E2E Tests:**
- `tests/e2e/notifications.spec.ts`
  - Test banner display and dismissal
  - Test notification feed
  - Test preferences update
  - Test admin CRUD operations

**Manual Testing Checklist:**
- [ ] Create notification in admin console
- [ ] Publish notification
- [ ] Verify banner appears for eligible users
- [ ] Click banner CTA and verify tracking
- [ ] Dismiss banner and verify it doesn't reappear
- [ ] Check notification feed
- [ ] Mark notifications as read
- [ ] Update user preferences
- [ ] Verify preferences are respected
- [ ] Send test email
- [ ] Verify email delivery
- [ ] Check analytics dashboard
- [ ] Test all filters and targeting options

---

## 🚀 Quick Start Guide

### Step 1: Install Dependencies
```bash
npm install resend
```

### Step 2: Configure Environment
```bash
# Add to .env.local
RESEND_API_KEY=your_api_key_here
RESEND_FROM_EMAIL=notifications@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 3: Run Database Migration
```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard SQL Editor
```

### Step 4: Verify Backend
```bash
# Start dev server
npm run dev

# Test endpoints
curl http://localhost:3000/api/notifications/active?userId=test-user-id
curl http://localhost:3000/api/notifications/feed?userId=test-user-id
```

### Step 5: Build Frontend Components
Follow the component specifications in section "4. Frontend Components" above.

### Step 6: Create First Notification
1. Navigate to `/admin/backoffice/notifications`
2. Click "Create Notification"
3. Fill in content, audience, schedule, channels
4. Save as draft
5. Test email send
6. Publish

---

## 📚 API Documentation

### Public Endpoints

#### Get Active Banner
```
GET /api/notifications/active?userId={userId}
```
**Response:**
```json
{
  "banner": {
    "id": "uuid",
    "title": "Welcome to Lexyhub!",
    "body": "Check out our new features...",
    "cta_text": "Learn More",
    "cta_url": "/features",
    "severity": "info",
    "priority": 80,
    "icon": "🎉"
  }
}
```

#### Get Notification Feed
```
GET /api/notifications/feed?userId={userId}&page=1&limit=20&unread=true
```
**Response:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  },
  "unread_count": 12
}
```

#### Track Delivery
```
POST /api/notifications/delivery
Headers: x-user-id: {userId}
Body: {
  "notification_id": "uuid",
  "action": "click"
}
```

#### Get Preferences
```
GET /api/notifications/prefs?userId={userId}
```

#### Update Preferences
```
PATCH /api/notifications/prefs?userId={userId}
Body: {
  "category": "keyword",
  "email_enabled": false,
  "email_frequency": "weekly"
}
```

### Admin Endpoints

All admin endpoints require admin authentication via `requireAdminUser()`.

#### List Notifications
```
GET /api/admin/backoffice/notifications?status=live&kind=banner&page=1
```

#### Create Notification
```
POST /api/admin/backoffice/notifications
Body: {
  "kind": "banner",
  "category": "system",
  "title": "System Maintenance",
  "body": "Scheduled maintenance tonight...",
  "severity": "warning",
  "show_banner": true
}
```

#### Publish Notification
```
POST /api/admin/backoffice/notifications/{id}/publish
```

#### Get Metrics
```
GET /api/admin/backoffice/notifications/{id}/metrics?include_records=true
```

---

## 🎨 Component Examples

### TopBanner Component Skeleton

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function TopBanner({ userId }: { userId: string }) {
  const [banner, setBanner] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchBanner();
    const interval = setInterval(fetchBanner, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [userId]);

  async function fetchBanner() {
    const res = await fetch(`/api/notifications/active?userId=${userId}`);
    const data = await res.json();
    setBanner(data.banner);
  }

  async function handleDismiss() {
    await fetch('/api/notifications/delivery', {
      method: 'POST',
      headers: { 'x-user-id': userId, 'content-type': 'application/json' },
      body: JSON.stringify({ notification_id: banner.id, action: 'dismiss' }),
    });
    setIsVisible(false);
  }

  async function handleClick() {
    await fetch('/api/notifications/delivery', {
      method: 'POST',
      headers: { 'x-user-id': userId, 'content-type': 'application/json' },
      body: JSON.stringify({ notification_id: banner.id, action: 'click' }),
    });
    window.location.href = banner.cta_url;
  }

  if (!banner || !isVisible) return null;

  const severityColors = {
    info: 'bg-blue-50 border-blue-500',
    success: 'bg-green-50 border-green-500',
    warning: 'bg-yellow-50 border-yellow-500',
    critical: 'bg-red-50 border-red-500',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`border-l-4 ${severityColors[banner.severity]} p-4 flex items-center justify-between`}
      >
        <div className="flex items-center gap-4 flex-1">
          {banner.icon && <span className="text-2xl">{banner.icon}</span>}
          <div>
            <h3 className="font-semibold">{banner.title}</h3>
            {banner.body && <p className="text-sm text-gray-600">{banner.body}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {banner.cta_text && (
            <button
              onClick={handleClick}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {banner.cta_text}
            </button>
          )}
          <button onClick={handleDismiss} className="p-2 hover:bg-gray-200 rounded">
            <X size={20} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## 🔧 Troubleshooting

### Issue: Resend import error
**Solution:** Ensure `resend` package is installed and API key is set in environment.

### Issue: Migration fails
**Solution:** Check for existing tables. Drop manually if needed:
```sql
DROP TABLE IF EXISTS user_notification_prefs CASCADE;
DROP TABLE IF EXISTS notification_delivery CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS notification_segments CASCADE;
```

### Issue: RLS policy denies access
**Solution:** Verify user has correct permissions. Check `user_profiles.plan` for admin users.

### Issue: Email not sending
**Solution:**
1. Verify RESEND_API_KEY is correct
2. Verify sending domain is verified in Resend dashboard
3. Check logs for detailed error messages

---

## 📖 Architecture Decisions

### Why Resend?
- Modern, developer-friendly API
- Excellent deliverability
- Built-in webhook support
- React email template support (future enhancement)
- Generous free tier

### Why Not WebSocket?
- Supabase Realtime provides real-time subscriptions
- Polling is simpler and sufficient for MVP
- WebSocket can be added later if needed

### Why Separate Delivery Table?
- Enables per-user tracking
- Supports impression limits
- Allows detailed analytics
- Decouples notification definition from delivery state

### Why jsonb for Filters?
- Flexible audience targeting
- No schema changes for new filter types
- Easy to extend
- Postgres jsonb is performant with proper indexes

---

## 🎯 Success Metrics

Track these KPIs in analytics dashboard:
- Banner CTR ≥ 8%
- Email open rate ≥ 40%
- Dismiss rate < 15%
- Time to delivery < 60s
- Opt-out rate < 2% (exclude account/billing)

---

## 📝 Next Steps

1. ✅ Backend infrastructure complete
2. ⏳ Install dependencies (`npm install resend`)
3. ⏳ Run database migration
4. ⏳ Build frontend components
5. ⏳ Test end-to-end
6. ⏳ Deploy to production
7. ⏳ Monitor metrics
8. ⏳ Phase 2: Background jobs, real-time, advanced features

---

## 🤝 Support

For questions or issues:
- Check logs: `src/lib/logger.ts`
- Review Supabase Dashboard: Database > Tables
- Test API endpoints with curl/Postman
- Check Resend Dashboard for email delivery status

---

**Implementation Status:** Backend complete, frontend pending
**Estimated Completion Time:** 8-12 hours for full frontend + testing
**Priority:** High - Core feature for user engagement

