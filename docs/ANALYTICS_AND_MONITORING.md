# Analytics and Monitoring Guide

This document explains how to use Sentry (error tracking) and PostHog (analytics) throughout the LexyHub application.

## Table of Contents

- [Overview](#overview)
- [Setup](#setup)
- [Sentry - Error Tracking](#sentry---error-tracking)
- [PostHog - Analytics](#posthog---analytics)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

## Overview

LexyHub uses two primary monitoring and analytics tools:

1. **Sentry** - Error tracking, performance monitoring, and debugging
2. **PostHog** - Product analytics, user behavior tracking, and feature flags

Both tools are integrated throughout the application and automatically capture important events and errors.

## Setup

### Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/your-project-id
SENTRY_ORG=your-sentry-org
SENTRY_PROJECT=your-sentry-project
SENTRY_AUTH_TOKEN=your-sentry-auth-token

# PostHog Configuration
NEXT_PUBLIC_POSTHOG_KEY=phc_your-posthog-key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Getting API Keys

#### Sentry

1. Sign up at [sentry.io](https://sentry.io)
2. Create a new project for your Next.js application
3. Get your DSN from Project Settings → Client Keys
4. Get auth token from Settings → Account → API → Auth Tokens

#### PostHog

1. Sign up at [posthog.com](https://posthog.com)
2. Create a new project
3. Get your API key from Project Settings → API Keys

## Sentry - Error Tracking

### Automatic Error Capture

Sentry automatically captures:

- Unhandled exceptions (client & server)
- Failed API requests
- React component errors
- Promise rejections

### Manual Error Capture

#### Using the Logger

The integrated logger automatically sends errors to Sentry:

```typescript
import { log, logException } from '@/lib/logger';

// Log an error message
log.error('Something went wrong', { userId, context });

// Log an exception with full stack trace
try {
  await riskyOperation();
} catch (error) {
  logException(error as Error, { operation: 'riskyOperation', userId });
}
```

#### Using Analytics Hooks

```typescript
import { captureError, captureMessage } from '@/lib/analytics/hooks';

// Capture an error
try {
  await fetchData();
} catch (error) {
  captureError(error as Error, { context: 'data-fetch' });
}

// Capture a message
captureMessage('Rate limit exceeded', 'warning', { endpoint: '/api/keywords' });
```

### Performance Monitoring

```typescript
import { startTransaction } from '@/lib/analytics/hooks';

async function expensiveOperation() {
  const transaction = startTransaction('expensive-operation', 'function');

  try {
    // ... your code
  } finally {
    transaction();
  }
}
```

### Setting User Context

User context is automatically set on login/signup, but you can also set it manually:

```typescript
import { setUserContext } from '@/lib/logger';

setUserContext(userId, {
  email: user.email,
  plan: user.plan,
  name: user.name,
});
```

### Background Jobs

Initialize Sentry in your background jobs:

```typescript
import { initSentryForJob, wrapJobWithSentry, flushSentry } from '@/lib/monitoring/sentry-jobs';

async function main() {
  // Option 1: Manual initialization
  initSentryForJob('my-job-name');

  try {
    // Your job logic
  } catch (error) {
    console.error(error);
  } finally {
    await flushSentry();
  }
}

// Option 2: Automatic wrapping
const job = wrapJobWithSentry('my-job-name', async () => {
  // Your job logic
});

await job();
await flushSentry();
```

## PostHog - Analytics

### Automatic Tracking

PostHog automatically tracks:

- Page views
- Session recordings (with sensitive data masked)
- Click events
- Form submissions

### Event Tracking

Use the tracking utilities to track custom events:

```typescript
import { trackAnalyticsEvent, AnalyticsEvents } from '@/lib/analytics/tracking';

// Track a standard event
trackAnalyticsEvent(AnalyticsEvents.KEYWORD_SEARCHED, {
  query: 'handmade soap',
  results: 42,
});

// Track a custom event
trackAnalyticsEvent('custom_event_name', {
  property1: 'value1',
  property2: 123,
});
```

### User Identification

Identify users to track them across sessions:

```typescript
import { identifyAnalyticsUser } from '@/lib/analytics/tracking';

// On successful login/signup
identifyAnalyticsUser(userId, {
  email: user.email,
  name: user.name,
  plan: user.plan,
  createdAt: user.createdAt,
});
```

### Resetting User (Logout)

```typescript
import { resetAnalyticsUser } from '@/lib/analytics/tracking';

// On logout
resetAnalyticsUser();
```

### Feature Flags

```typescript
import { trackFeatureFlag } from '@/lib/analytics/tracking';
import { posthog } from '@/lib/analytics/posthog';

// Check feature flag
const isEnabled = posthog.isFeatureEnabled('new-feature');

// Track the evaluation
trackFeatureFlag('new-feature', isEnabled);
```

## Usage Examples

### Example 1: Tracking User Actions in a Component

```typescript
'use client';

import { trackAnalyticsEvent, AnalyticsEvents } from '@/lib/analytics/tracking';
import { captureError } from '@/lib/analytics/hooks';

export function KeywordSearch() {
  const handleSearch = async (query: string) => {
    try {
      const results = await searchKeywords(query);

      // Track successful search
      trackAnalyticsEvent(AnalyticsEvents.KEYWORD_SEARCHED, {
        query,
        results_count: results.length,
        source: 'dashboard',
      });

      return results;
    } catch (error) {
      // Track error
      captureError(error as Error, {
        context: 'keyword_search',
        query,
      });

      throw error;
    }
  };

  // ... component logic
}
```

### Example 2: API Route with Monitoring

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { logApiCall, logException } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // Add context to Sentry
    Sentry.setContext('api_request', {
      endpoint: '/api/keywords',
      method: 'POST',
      body,
    });

    // ... your logic

    const duration = Date.now() - startTime;
    logApiCall('POST', '/api/keywords', 200, duration, { userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;

    logException(error as Error, {
      endpoint: '/api/keywords',
      method: 'POST',
    });

    logApiCall('POST', '/api/keywords', 500, duration);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Example 3: Tracking Conversions

```typescript
import { trackConversion, AnalyticsEvents } from '@/lib/analytics/tracking';

async function handleCheckout(plan: string, amount: number) {
  // Process payment...

  // Track conversion
  trackConversion(AnalyticsEvents.SUBSCRIPTION_STARTED, amount, {
    plan,
    currency: 'USD',
    payment_method: 'stripe',
  });
}
```

### Example 4: Background Job Monitoring

```typescript
import { wrapJobWithSentry, captureJobCheckpoint, flushSentry } from '@/lib/monitoring/sentry-jobs';
import { logJobExecution } from '@/lib/logger';

const job = wrapJobWithSentry('keyword-refresh', async () => {
  logJobExecution('keyword-refresh', 'started');

  const keywords = await fetchKeywords();

  for (let i = 0; i < keywords.length; i++) {
    await processKeyword(keywords[i]);

    // Capture progress
    if (i % 100 === 0) {
      captureJobCheckpoint('keyword-refresh', 'progress', {
        processed: i,
        total: keywords.length,
      });
    }
  }

  logJobExecution('keyword-refresh', 'completed', Date.now() - startTime);
});

async function main() {
  try {
    await job();
  } catch (error) {
    logJobExecution('keyword-refresh', 'failed', Date.now() - startTime);
  } finally {
    await flushSentry();
  }
}

main();
```

## Best Practices

### Do's ✅

- **Do** identify users on login/signup
- **Do** reset analytics on logout
- **Do** track important user actions (searches, purchases, feature usage)
- **Do** add context to errors (user ID, operation, relevant data)
- **Do** use standard event names from `AnalyticsEvents`
- **Do** sanitize sensitive data (passwords, tokens, API keys)
- **Do** flush Sentry in background jobs before exit

### Don'ts ❌

- **Don't** track PII (passwords, credit cards, SSNs)
- **Don't** track too frequently (avoid tracking every keystroke)
- **Don't** log sensitive authentication tokens
- **Don't** block user experience waiting for tracking
- **Don't** use tracking for business-critical operations

### Performance Considerations

- All tracking is asynchronous and non-blocking
- Failed tracking events don't affect user experience
- Sentry samples transactions (10% in production by default)
- PostHog batches events automatically

### Data Privacy

- Passwords are automatically redacted from logs
- Session recordings mask all input fields by default
- Add `data-private` attribute to elements that should never be recorded:

```html
<div data-private>Sensitive content</div>
```

### Testing

In development:

- Sentry debug mode is enabled
- PostHog debug mode is enabled
- All transactions are sampled (100%)
- Events are logged to console

## Standard Event Names

Use the predefined event names from `AnalyticsEvents`:

### Authentication
- `USER_SIGNED_UP`
- `USER_LOGGED_IN`
- `USER_LOGGED_OUT`
- `USER_PROFILE_UPDATED`

### Billing
- `SUBSCRIPTION_STARTED`
- `SUBSCRIPTION_UPGRADED`
- `SUBSCRIPTION_CANCELED`
- `PAYMENT_COMPLETED`
- `PAYMENT_FAILED`

### Product Features
- `KEYWORD_SEARCHED`
- `KEYWORD_ADDED_TO_WATCHLIST`
- `TREND_VIEWED`
- `COMPETITOR_ANALYZED`
- `REPORT_GENERATED`
- `REPORT_EXPORTED`

### Integrations
- `ETSY_CONNECTED`
- `PINTEREST_CONNECTED`
- `REDDIT_CONNECTED`

### Errors
- `ERROR_OCCURRED`
- `API_ERROR`

See `src/lib/analytics/tracking.ts` for the complete list.

## Troubleshooting

### Monitoring Not Working

If your Sentry or PostHog dashboards are not receiving data:

1. **Check Configuration**
   - Visit `/admin/monitoring` to see the status of both services
   - Verify environment variables are set correctly in `.env.local`
   - Restart your development server after changing environment variables

2. **Console Warnings**
   - Check your browser console and terminal for warning messages
   - You should see initialization messages when configured properly:
     - `✅ Sentry client initialized successfully`
     - `✅ PostHog initialized successfully`

3. **Environment Variables**
   - Ensure variables start with `NEXT_PUBLIC_` for client-side access
   - Sentry DSN format: `https://[key]@[org].ingest.sentry.io/[project-id]`
   - PostHog key format: starts with `phc_`

4. **Test Events**
   - Go to `/admin/monitoring` and use the "Send Test Event" buttons
   - Check your dashboards within 1-2 minutes
   - Test events are tagged with `test: true` for easy filtering

### Common Issues

#### "PostHog is not initialized"

This means the PostHog library couldn't initialize. Check:
- `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
- The key starts with `phc_`
- You've restarted your dev server

#### PostHog 401 (Unauthorized) Errors

If you see 401 errors in the browser console when PostHog tries to send events:

```
POST https://eu.i.posthog.com/i/v0/e/ 401 (Unauthorized)
```

This means your PostHog API key is invalid or misconfigured. Common causes:

1. **Wrong API key**: The key in `NEXT_PUBLIC_POSTHOG_KEY` is invalid or expired
2. **Instance mismatch**: Using a key from one PostHog instance (US/EU) with a different host
   - Example: EU key with US host (`https://app.posthog.com`)
   - Example: US key with EU host (`https://eu.posthog.com`)
3. **Wrong key type**: Using a personal API key instead of a project key
   - Project keys start with `phc_`
   - Personal API keys start with `phx_` (these don't work for client-side tracking)
4. **Incorrect host format**: Using the ingestion endpoint instead of the base domain
   - ❌ Wrong: `https://eu.i.posthog.com` (ingestion endpoint)
   - ✅ Correct: `https://eu.posthog.com` (base domain)

**Solutions**:

1. Get your **project key** (not personal key) from PostHog:
   - For US: https://app.posthog.com/project/settings
   - For EU: https://eu.posthog.com/project/settings
2. Ensure `NEXT_PUBLIC_POSTHOG_KEY` starts with `phc_`
3. **IMPORTANT**: Use the BASE domain for `NEXT_PUBLIC_POSTHOG_HOST`, NOT the ingestion endpoint:
   ```bash
   # For US instance
   NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
   # NOT: https://us.i.posthog.com

   # For EU instance
   NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
   # NOT: https://eu.i.posthog.com
   ```
   The PostHog SDK automatically constructs the ingestion endpoint from the base domain.
4. Restart your development server or redeploy your application after changing environment variables
5. Check the browser console for detailed error messages and configuration debugging info

#### "Sentry not capturing errors in development"

By default, Sentry captures all errors in development if the DSN is set. If you're not seeing errors:
- Check the DSN is correct
- Verify the project exists in your Sentry dashboard
- Test with the monitoring page: `/admin/monitoring`

#### Events Not Showing in Production

In production, some events are sampled:
- Performance transactions: 10% sample rate
- Session replays: 10% sample rate
- Errors: 100% capture rate

To see more events in production, adjust sample rates in the Sentry config files.

### Debugging Tips

1. **Enable Debug Mode in Development**
   Both services automatically enable debug mode in development and log to the console.

2. **Check Network Requests**
   - Open browser DevTools → Network tab
   - Filter for requests to `sentry.io` or `posthog.com`
   - Verify requests are being sent with status 200

3. **Verify Initialization**
   ```typescript
   // In browser console
   window.__SENTRY__ // Should be defined if Sentry is loaded

   // Check PostHog
   import { isPostHogReady } from '@/lib/analytics/posthog'
   console.log(isPostHogReady()) // Should return true
   ```

## Monitoring Status Page

Visit `/admin/monitoring` to:
- Check configuration status of both services
- Send test events to verify connectivity
- View setup instructions
- Validate environment variables

This page provides:
- ✅ Real-time configuration status
- 🧪 Test event buttons for both services
- 📝 Quick setup guide with copy-paste examples
- ⚙️ Environment variable validation

## Support

For issues or questions:

- **Sentry**: [docs.sentry.io](https://docs.sentry.io)
- **PostHog**: [posthog.com/docs](https://posthog.com/docs)
- **Internal**: Check `src/lib/analytics/` and `src/lib/logger.ts`
- **Monitoring Status**: Visit `/admin/monitoring` for diagnostics
