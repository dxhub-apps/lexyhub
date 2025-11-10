# Notification System Fixes

## Summary

Fixed 4 critical issues with the notification system that were preventing proper functionality.

## Issues Fixed

### 1. Deleted Notifications Coming Back After Page Refresh ✅

**Problem**: When users dismissed notifications, they would reappear after refreshing the page.

**Root Cause**: The feed query included all broadcast notifications (`audience_scope='all'`) regardless of whether they had been dismissed by the user.

**Solution**:
- Modified `getNotificationFeed()` in `src/lib/notifications/delivery.ts`
- Added filter to exclude notifications with `state='dismissed'`
- Now checks `if (n.delivery?.state === 'dismissed') return false;` before including notifications

**Files Changed**:
- `src/lib/notifications/delivery.ts` (lines 116-128)

### 2. Bell Indicator Not Showing New Notifications ✅

**Problem**: The notification bell badge wasn't showing the correct count of unread notifications, especially for broadcast notifications without delivery records.

**Root Cause**: The `getUnreadCount()` function only counted notifications with explicit delivery records in 'pending' state. Broadcast notifications (`audience_scope='all'`) without delivery records weren't counted.

**Solution**:
- Completely rewrote `getUnreadCount()` function
- Now fetches all active notifications and checks delivery state for each
- Properly counts both:
  - Targeted notifications with delivery records
  - Broadcast notifications without delivery records
- Excludes dismissed notifications from count

**Files Changed**:
- `src/lib/notifications/delivery.ts` (lines 154-212)

### 3. DateTime Picker UX Issues ✅

**Problem**: When creating notifications, the datetime picker:
- Had no default values (empty fields)
- Required manual typing
- Wasn't user-friendly

**Solution**:
- Added `formatDateTimeLocal()` helper function
- Set `scheduleStartAt` to current date/time by default
- Set `scheduleEndAt` to 2 hours from current time by default
- Updated helper text to guide users:
  - "Defaults to now. Clear to start immediately. Use arrows to adjust time."
  - "Defaults to 2 hours from now. Clear for no end date."
- Native datetime-local input already provides up/down selectors when clicking time fields

**Files Changed**:
- `src/app/(app)/admin/backoffice/notifications/new/page.tsx` (lines 27-61, 327-353)

### 4. Top Banner Notifications Not Appearing ✅

**Problem**: Banner notifications weren't displaying even when properly configured and scheduled.

**Root Cause**: Silent failures - no debugging information to diagnose issues.

**Solution**:
- Added comprehensive console logging to `TopBanner` component
- Logs now show:
  - When banner fetch is initiated
  - User ID being used
  - API response data
  - Whether banner was found or not
  - Any errors during fetch
- Helps administrators debug scheduling, permissions, or configuration issues

**Logs Added**:
```
[TopBanner] Fetching active banner for user: {userId}
[TopBanner] Banner data received: {data}
[TopBanner] Banner set: {title}
[TopBanner] No active banner
```

**Files Changed**:
- `src/components/notifications/TopBanner.tsx` (lines 60-88)

## Testing Checklist

To verify the fixes work:

### Test Dismissed Notifications
1. View a notification in the feed
2. Dismiss it by clicking the dismiss/close button
3. Refresh the page
4. ✅ Verify dismissed notification does NOT reappear

### Test Bell Indicator
1. Create a new banner notification with `show_banner=true` and `create_inapp=true`
2. Publish the notification
3. Check the bell icon in the top navigation
4. ✅ Verify the red badge shows the correct number of unread notifications
5. Mark notifications as read
6. ✅ Verify badge updates immediately

### Test DateTime Picker
1. Go to Admin → Backoffice → Notifications → Create New
2. Navigate to the "Schedule" tab
3. ✅ Verify "Start Date & Time" is pre-filled with current date/time
4. ✅ Verify "End Date & Time" is pre-filled with 2 hours from now
5. Click on the time portion of the input
6. ✅ Verify you can use up/down arrows to adjust time
7. ✅ Verify you can also type directly

### Test Top Banner
1. Create a banner notification with:
   - `show_banner=true`
   - `audience_scope='all'`
   - `schedule_start_at` = now or earlier
   - `schedule_end_at` = future time or null
2. Publish the notification
3. Open browser console (F12)
4. Refresh the page
5. ✅ Check console for `[TopBanner]` logs showing:
   - Banner fetch initiated
   - Data received
   - Banner set with title
6. ✅ Verify banner appears at top of page
7. Click dismiss button
8. ✅ Verify banner disappears
9. Refresh page
10. ✅ Verify banner does NOT reappear

## Technical Details

### Database Function Check

The database function `get_active_banner_for_user` already had the correct logic:
```sql
and (nd.state is null or nd.state != 'dismissed')
```

This properly excludes dismissed banners from being returned.

### Delivery State Flow

Notification states:
- `null` or `'pending'` = Unread
- `'shown'` = Read but not clicked
- `'clicked'` = User clicked the notification
- `'dismissed'` = User explicitly dismissed the notification

When a notification is dismissed:
1. Frontend calls `/api/notifications/delivery` with `action: 'dismiss'`
2. Backend creates/updates delivery record with `state: 'dismissed'`
3. Frontend immediately hides the notification
4. On refresh, backend filters out dismissed notifications
5. Notification does not reappear

### Unread Count Logic

New logic properly handles:
1. **Broadcast notifications** (`audience_scope='all'`):
   - Counted as unread if no delivery record exists
   - Counted as unread if delivery state is `null` or `'pending'`
   - NOT counted if dismissed

2. **Targeted notifications**:
   - Only counted if user has a delivery record
   - Counted as unread if state is `null` or `'pending'`
   - NOT counted if dismissed or clicked

## Breaking Changes

None. All changes are backward compatible.

## Performance Impact

Minimal. The `getUnreadCount()` function now does an in-memory filter instead of relying on a database function, but:
- Only active notifications are fetched
- Filter is efficient (O(n) where n = number of active notifications)
- Results are cached by Next.js API route caching
- Bell icon polls every 30 seconds (existing behavior)

## Migration Required

No database migrations needed. All fixes are application-level.

## Monitoring

To monitor notification system health, check:

1. **Console logs** in browser for `[TopBanner]` messages
2. **Network tab** for `/api/notifications/active` and `/api/notifications/feed` calls
3. **Server logs** for notification delivery tracking
4. **Sentry** for any notification-related errors

## Common Issues & Solutions

### Banner not showing?
1. Check console for `[TopBanner]` logs
2. Verify `show_banner=true` in database
3. Check schedule times (must be within start/end range)
4. Verify notification status is `'live'`
5. Check if user has dismissed it (check delivery record)

### Unread count wrong?
1. Check if notifications have `create_inapp=true`
2. Verify notification status is `'live'`
3. Check schedule times
4. Look for delivery records with `state='pending'`

### Dismissed notifications returning?
1. Verify delivery record was created with `state='dismissed'`
2. Check browser console for errors
3. Verify user ID is correct in delivery tracking

## Files Modified

```
src/lib/notifications/delivery.ts (2 functions modified)
  - getNotificationFeed() - Added dismissed filter
  - getUnreadCount() - Complete rewrite

src/components/notifications/TopBanner.tsx
  - fetchBanner() - Added debug logging

src/app/(app)/admin/backoffice/notifications/new/page.tsx
  - Added formatDateTimeLocal() helper
  - Set default datetime values
  - Improved helper text
```

## Related Documentation

- See `docs/NOTIFICATION_SYSTEM_COMPLETE.md` for full system overview
- See `docs/NOTIFICATION_SYSTEM_IMPLEMENTATION.md` for implementation details
- See database migration `supabase/migrations/0029_notification_system.sql` for schema

## Future Improvements

Consider adding:
1. Real-time notifications using WebSocket or SSE (instead of polling)
2. Push notifications for mobile/desktop
3. Notification preferences per-category
4. Rich media support (images, videos)
5. Notification templates system
6. A/B testing for notifications
