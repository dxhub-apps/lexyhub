# Sentry Integration Debug Report

**Date:** 2025-11-08
**Status:** ❌ NOT WORKING - Missing instrumentation.ts

## Problem Summary

Sentry is not receiving events because the **`instrumentation.ts` file is missing**, which is required for Next.js 14+ to properly initialize Sentry on the server-side and edge runtime.

## Root Cause Analysis

### Critical Issues Found

1. **❌ Missing `instrumentation.ts` File (PRIMARY ISSUE)**
   - Next.js 14.2+ requires an `instrumentation.ts` file to initialize Sentry on server-side
   - Without this file, `sentry.server.config.ts` and `sentry.edge.config.ts` are NEVER loaded
   - This means server-side and API route errors are NOT being captured at all
   - Client-side initialization works, but server-side is completely broken

2. **❌ Missing `experimental.instrumentationHook` Config**
   - Next.js 14.2 requires explicitly enabling the instrumentation hook
   - Without `experimental.instrumentationHook: true` in `next.config.mjs`, the instrumentation file is ignored
   - This is required until Next.js 15 where it becomes stable

3. **❌ Missing Automatic Instrumentation Options**
   - `autoInstrumentServerFunctions` not enabled - API routes and data fetchers not automatically instrumented
   - `autoInstrumentMiddleware` not enabled - middleware errors not captured
   - Missing build options means less comprehensive error tracking

### What Was Already Working

1. **✅ Sentry Package Installed**
   - `@sentry/nextjs` version 10.23.0 is installed
   - All required dependencies are present

2. **✅ Configuration Files Present**
   - `sentry.client.config.ts` - Client-side configuration (working)
   - `sentry.server.config.ts` - Server-side configuration (not being loaded)
   - `sentry.edge.config.ts` - Edge runtime configuration (not being loaded)
   - All files are properly configured with correct initialization

3. **✅ Integration Code Present**
   - Logger integration at `src/lib/logger.ts`
   - Multiple error capture points throughout the codebase:
     - `logException()` function captures errors to Sentry
     - `log.error()` and `log.fatal()` send messages to Sentry
     - 20+ integration points across the application

4. **✅ DSN Configured**
   - `NEXT_PUBLIC_SENTRY_DSN` is set in environment
   - Client-side Sentry could potentially work
   - Server-side Sentry was never initialized due to missing instrumentation

### The Real Problem

The Sentry configs were never being loaded on the server-side because Next.js 14.2 doesn't automatically load `sentry.server.config.ts` - you MUST use the `instrumentation.ts` hook to load them. This is a breaking change from older Next.js versions.

## The Fix

All fixes have been applied automatically. Here's what was done:

### Step 1: Created `instrumentation.ts` File ✅

Created `/instrumentation.ts` in the project root that loads Sentry configs based on runtime:

```typescript
export async function register() {
  // Initialize Sentry for Node.js server runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  // Initialize Sentry for Edge runtime
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

### Step 2: Enabled Instrumentation Hook in Next.js Config ✅

Updated `next.config.mjs` to enable the experimental instrumentation hook:

```javascript
experimental: {
  // Enable instrumentation for Sentry and other monitoring tools
  instrumentationHook: true,
}
```

### Step 3: Added Automatic Instrumentation Options ✅

Updated `next.config.mjs` with automatic instrumentation:

```javascript
const sentryBuildOptions = {
  // Automatically instrument the code for Sentry
  autoInstrumentServerFunctions: true,  // Auto-instrument API routes
  autoInstrumentMiddleware: true,        // Auto-instrument middleware
  hideSourceMaps: true,                  // Hide source maps from public
  disableLogger: process.env.NODE_ENV === "development",
};
```

### Step 4: Enhanced Logging for Debugging ✅

Added development-only logging to track when events are being sent:
- Client config logs all events being sent
- Server config logs all events being sent
- Filtered events are logged for debugging

### Step 5: Restart Your Development Server

```bash
npm run dev
```

You should now see these logs on startup:

```
🔍 Sentry Client Configuration
Environment: development
DSN Configured: true
DSN Preview: https://your-key-here@your-org.ingest...
✅ Sentry client initialized successfully
   - Traces Sample Rate: 100%
   - Replays Session Sample Rate: 10%
   - Replays On Error Sample Rate: 100%
📤 To test Sentry, visit: /api/test-sentry

🔍 Sentry Server Configuration
Environment: development
DSN Configured: true
DSN Preview: https://your-key-here@your-org.ingest...
✅ Sentry server initialized successfully
   - Traces Sample Rate: 100%
   - Integrations: HTTP, Prisma, Postgres
```

### Step 4: Test Sentry Integration

Visit these endpoints to test Sentry:

```bash
# Test info message
curl http://localhost:3000/api/test-sentry

# Test error capture
curl http://localhost:3000/api/test-sentry?error=1

# Test fatal error
curl http://localhost:3000/api/test-sentry?fatal=1

# Test all event types
curl http://localhost:3000/api/test-sentry?all=1
```

Or open in browser:
- http://localhost:3000/api/test-sentry

### Step 5: Verify Events in Sentry

1. Go to your Sentry dashboard: https://sentry.io/
2. Navigate to **Issues**
3. You should see test events appear within seconds
4. Look for events tagged with `test: true`

## Changes Made

### Enhanced Debug Logging

Updated all three Sentry configuration files with comprehensive logging:

1. **sentry.client.config.ts**
   - Added startup configuration group logging
   - Shows DSN status, environment, and configuration details
   - Displays helpful error messages when DSN is missing
   - Shows test endpoint URL in development

2. **sentry.server.config.ts**
   - Added server-side configuration logging
   - Shows integrations status (HTTP, Prisma, Postgres)
   - Clear indication when Sentry is disabled

3. **sentry.edge.config.ts**
   - Added edge runtime configuration logging
   - Consistent logging format across all runtimes

### New Test Endpoint

Created `/api/test-sentry` endpoint for easy testing:

- **Location:** `src/app/api/test-sentry/route.ts`
- **Features:**
  - Check Sentry configuration status
  - Send test messages
  - Trigger test errors
  - Trigger fatal errors
  - Send all test event types at once
  - Returns detailed status and instructions
  - Flushes events immediately for instant verification

**Usage:**
```bash
GET /api/test-sentry          # Send test message
GET /api/test-sentry?error=1  # Trigger error
GET /api/test-sentry?fatal=1  # Trigger fatal
GET /api/test-sentry?all=1    # All tests
```

## Verification Checklist

After setting up the DSN, verify:

- [ ] Development server starts without Sentry warnings
- [ ] Console shows "✅ Sentry [client/server/edge] initialized successfully"
- [ ] `/api/test-sentry` returns success response
- [ ] Events appear in Sentry dashboard within seconds
- [ ] Error tracking works in your application
- [ ] User context is captured correctly

## Configuration Details

### Current Sentry Settings

**Development:**
- Traces Sample Rate: 100% (capture all transactions)
- Profiles Sample Rate: 100%
- Replays Session Sample Rate: 10%
- Replays On Error Sample Rate: 100%

**Production:**
- Traces Sample Rate: 10% (reduce volume)
- Profiles Sample Rate: 10%
- Replays Session Sample Rate: 10%
- Replays On Error Sample Rate: 100%

### Security Features

The configuration includes:

1. **Sensitive Data Redaction**
   - Removes authorization headers
   - Removes cookies from events
   - Sanitizes request data

2. **Noise Filtering**
   - Ignores browser extension errors
   - Filters network errors
   - Excludes ResizeObserver errors
   - Blocks known noisy error patterns

3. **Replay Privacy**
   - Masks all text content
   - Blocks all media content

## Integration Points

Sentry is integrated throughout the application:

1. **Logger Module** (`src/lib/logger.ts`)
   - `logException()` - Capture exceptions with context
   - `log.error()` - Send error messages
   - `log.fatal()` - Send fatal error messages
   - `setUserContext()` - Associate errors with users
   - `clearUserContext()` - Clear user on logout

2. **Error Boundaries**
   - Automatic error capture in Next.js error boundaries
   - Client-side unhandled rejections
   - Server-side exceptions

3. **API Routes**
   - 20+ integration points across the codebase
   - Automatic error tracking in API handlers
   - Request context included in events

4. **External Services**
   - RunPod client errors
   - LexBrain operations
   - Analytics tracking errors
   - Database operation errors

## Next Steps

1. **Immediate:**
   - [ ] Get Sentry DSN from dashboard
   - [ ] Create `.env.local` with DSN
   - [ ] Restart development server
   - [ ] Test with `/api/test-sentry` endpoint

2. **Production:**
   - [ ] Set `NEXT_PUBLIC_SENTRY_DSN` in production environment
   - [ ] Configure `SENTRY_AUTH_TOKEN` for source map uploads
   - [ ] Set `SENTRY_ORG` and `SENTRY_PROJECT` for releases
   - [ ] Verify events in production Sentry project

3. **Optional Enhancements:**
   - [ ] Set up Sentry alerts for critical errors
   - [ ] Configure Sentry releases for better tracking
   - [ ] Add custom performance metrics
   - [ ] Set up error grouping rules
   - [ ] Configure user feedback collection

## Support Resources

- **Sentry Documentation:** https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Get DSN:** https://sentry.io/settings/projects/
- **Configuration Guide:** https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/
- **Test Endpoint:** http://localhost:3000/api/test-sentry

## Conclusion

The root cause was a **missing `instrumentation.ts` file and incomplete Next.js configuration** for Sentry with Next.js 14.2+. All fixes have been applied:

**What Was Fixed:**
- ✅ Created `instrumentation.ts` file
- ✅ Enabled `experimental.instrumentationHook` in Next.js config
- ✅ Added automatic instrumentation options
- ✅ Enhanced debug logging
- ✅ Test endpoint already created

**What Was Already Working:**
- ✅ Package installed (@sentry/nextjs 10.23.0)
- ✅ Configuration files present and correct
- ✅ Integration code throughout the app
- ✅ DSN configured in environment

**Next Steps:**
1. Restart your development server (`npm run dev`)
2. Watch for Sentry initialization logs in console
3. Test with `/api/test-sentry` endpoint
4. Verify events appear in Sentry dashboard

**Estimated time to verify:** 2-3 minutes (restart and test)
