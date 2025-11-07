# Monitoring & Analytics Fixes

## Summary

Fixed critical issues preventing Sentry and PostHog from working correctly. Both services were failing silently due to missing environment variables and initialization problems.

## Problems Fixed

### 1. PostHog Not Initializing
**Issue**: PostHog was exporting the library before initialization, causing tracking calls to fail silently.

**Fix**:
- Added singleton initialization pattern with `isInitialized` flag
- Created `getPostHog()` and `isPostHogReady()` helper functions
- Added console warnings when API key is missing
- Added success logging in development mode

**Files Changed**:
- `src/lib/analytics/posthog.ts`
- `src/lib/analytics/tracking.ts`
- `src/components/providers/posthog-provider.tsx`

### 2. Sentry Silent Failures
**Issue**: Sentry was disabled in development unless DSN was set, with no warnings.

**Fix**:
- Added console warnings when DSN is not configured
- Changed `enabled` flag to allow testing in all environments
- Added initialization success logging in development
- Improved error messages with setup instructions

**Files Changed**:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

### 3. No Environment Variable Validation
**Issue**: Missing environment variables caused silent failures with no feedback.

**Fix**:
- Created `src/lib/monitoring/config.ts` with validation utilities
- Added `validateMonitoringEnv()` function
- Added `getMonitoringStatus()` for status checks
- Added `logMonitoringStatus()` for debugging

**Files Changed**:
- `src/lib/monitoring/config.ts` (new file)

### 4. No Testing Interface
**Issue**: No way to test if monitoring services were working.

**Fix**:
- Created `/admin/monitoring` status page
- Added test buttons to send events to both services
- Real-time configuration status display
- Quick setup guide with environment variable examples

**Files Changed**:
- `src/app/(app)/admin/monitoring/page.tsx` (new file)

### 5. Tracking Code Using Unsafe References
**Issue**: Analytics tracking code directly imported `posthog` which might not be initialized.

**Fix**:
- Updated all tracking functions to use `getPostHog()` and `isPostHogReady()`
- Added null checks before calling PostHog methods
- Ensured graceful degradation when services aren't configured

**Files Changed**:
- `src/lib/analytics/tracking.ts`

## New Features

### Monitoring Status Page
Visit `/admin/monitoring` to:
- ✅ View configuration status of Sentry and PostHog
- 🧪 Send test events to verify connectivity
- 📝 Get setup instructions
- ⚙️ Check environment variables

### Console Warnings
When services aren't configured, you'll now see helpful warnings:

```
⚠️ PostHog: NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics will not be tracked.
To enable PostHog, add NEXT_PUBLIC_POSTHOG_KEY to your .env.local file.
```

```
⚠️ Sentry: NEXT_PUBLIC_SENTRY_DSN is not set. Error tracking will not be enabled.
To enable Sentry, add NEXT_PUBLIC_SENTRY_DSN to your .env.local file.
Get your DSN from: https://sentry.io/settings/projects/
```

### Success Logging (Development Only)
When properly configured, you'll see:

```
✅ Sentry client initialized successfully
✅ PostHog initialized successfully
✅ PostHog analytics enabled
```

## Setup Instructions

### 1. Create .env.local file

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token

# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 2. Get Your API Keys

**Sentry**:
1. Sign up at [sentry.io](https://sentry.io)
2. Create a new Next.js project
3. Get DSN from Project Settings → Client Keys

**PostHog**:
1. Sign up at [posthog.com](https://posthog.com)
2. Create a new project
3. Get API key from Project Settings → API Keys

### 3. Restart Development Server

```bash
npm run dev
```

### 4. Verify Setup

1. Check console for initialization messages
2. Visit `/admin/monitoring`
3. Click "Send Test Event" buttons
4. Check your Sentry and PostHog dashboards

## Testing

After setup, test both services:

1. **Test PostHog**:
   - Navigate to any page (should trigger pageview)
   - Use the app (events will be tracked)
   - Visit `/admin/monitoring` and click "Send Test Event"

2. **Test Sentry**:
   - Visit `/admin/monitoring` and click "Send Test Event"
   - Trigger an error in the app
   - Check Sentry dashboard for the error

Test events are tagged with `test: true` for easy filtering.

## Files Changed

### Modified Files
- `sentry.client.config.ts` - Added validation and warnings
- `sentry.server.config.ts` - Added validation and warnings
- `sentry.edge.config.ts` - Added validation and warnings
- `src/lib/analytics/posthog.ts` - Fixed initialization pattern
- `src/lib/analytics/tracking.ts` - Updated to use safe PostHog access
- `src/components/providers/posthog-provider.tsx` - Updated to use safe PostHog access
- `docs/ANALYTICS_AND_MONITORING.md` - Added troubleshooting section

### New Files
- `src/lib/monitoring/config.ts` - Monitoring configuration utilities
- `src/app/(app)/admin/monitoring/page.tsx` - Monitoring status page

## Key Improvements

1. **Better Error Messages**: Clear warnings when services aren't configured
2. **Graceful Degradation**: App works fine without monitoring configured
3. **Easy Testing**: Admin page to test both services
4. **Developer Experience**: Console logs show initialization status
5. **Documentation**: Comprehensive troubleshooting guide
6. **Validation**: Utilities to check monitoring configuration

## Breaking Changes

None. All changes are backward compatible. Existing code will continue to work.

## Next Steps

1. Set up Sentry and PostHog accounts if you haven't
2. Add environment variables to `.env.local`
3. Restart your development server
4. Visit `/admin/monitoring` to verify setup
5. Send test events to confirm data is reaching dashboards

## Troubleshooting

If data still isn't reaching dashboards after following the setup:

1. Check the browser console for warning messages
2. Visit `/admin/monitoring` to see configuration status
3. Verify environment variables in `.env.local`
4. Ensure you've restarted the dev server
5. Check network tab for requests to `sentry.io` and `posthog.com`

For more help, see the troubleshooting section in `docs/ANALYTICS_AND_MONITORING.md`.
