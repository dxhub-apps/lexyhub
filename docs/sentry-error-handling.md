# Sentry Error Handling Guide

This guide covers the comprehensive Sentry error tracking setup for LexyHub, including patterns for API routes, client components, and background jobs.

## Table of Contents

- [Overview](#overview)
- [Configuration](#configuration)
- [API Route Error Handling](#api-route-error-handling)
- [Client-Side Error Handling](#client-side-error-handling)
- [Background Job Error Handling](#background-job-error-handling)
- [Best Practices](#best-practices)
- [Testing](#testing)

## Overview

The application has comprehensive Sentry integration across:

- **Server Runtime**: Node.js server with automatic instrumentation
- **Edge Runtime**: Edge functions and middleware
- **Client Runtime**: Browser error tracking with React Error Boundaries
- **Background Jobs**: Standalone job error tracking
- **Global Handlers**: Uncaught exceptions and unhandled rejections

## Configuration

### Environment Variables

```env
# Required for Sentry to work
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id

# Build-time only (for source maps)
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

### Configuration Files

| File | Purpose |
|------|---------|
| `sentry.server.config.ts` | Node.js server runtime config |
| `sentry.edge.config.ts` | Edge runtime config |
| `instrumentation.ts` | Next.js instrumentation hook |
| `next.config.mjs` | Build-time source map upload |

## API Route Error Handling

### Method 1: Using `withErrorHandling` Wrapper (Recommended)

The easiest way to add comprehensive error tracking to API routes:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/error-handler";

export const GET = withErrorHandling(
  async (request: NextRequest): Promise<NextResponse> => {
    // Your route logic here
    const data = await fetchData();
    return NextResponse.json(data);
  },
  {
    feature: "dashboard",
    component: "metrics-endpoint"
  }
);
```

**Benefits:**
- Automatic error capture with full context
- Request ID generation and tracking
- Proper error response formatting
- User context setting
- Custom error class support

**Custom Error Classes:**

```typescript
import {
  AuthenticationError,
  ValidationError,
  NotFoundError
} from "@/lib/api/error-handler";

export const POST = withErrorHandling(
  async (request: NextRequest) => {
    const user = await getUser();
    if (!user) {
      throw new AuthenticationError("User not found");
    }

    const data = await request.json();
    if (!isValid(data)) {
      throw new ValidationError("Invalid input data");
    }

    // ... rest of logic
  },
  { feature: "users", component: "create-user" }
);
```

**Available Error Classes:**
- `ApiError` - Base error (500)
- `ValidationError` - Bad request (400)
- `AuthenticationError` - Unauthorized (401)
- `AuthorizationError` - Forbidden (403)
- `NotFoundError` - Not found (404)
- `RateLimitError` - Too many requests (429)
- `ExternalServiceError` - Service unavailable (503)

### Method 2: Manual Error Handling (For Complex Cases)

When you need more control over error handling:

```typescript
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    // Set Sentry context
    Sentry.setContext("custom_context", {
      requestId,
      // ... other context
    });

    // Your route logic
    const data = await processRequest();

    return NextResponse.json({ data, requestId });
  } catch (error) {
    // Log the error
    log.error("Error processing request", {
      error,
      requestId,
    });

    // Capture in Sentry
    Sentry.captureException(error, {
      tags: {
        feature: "your-feature",
        component: "your-component",
        requestId,
      },
      level: "error",
      extra: {
        // Additional context
      },
    });

    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
```

### Critical Routes Pattern (e.g., Webhooks)

For mission-critical routes like payment webhooks, use granular error handling:

```typescript
export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    const signature = request.headers.get("webhook-signature");
    const body = await request.text();

    // Verify webhook signature
    let event;
    try {
      event = verifyWebhook(signature, body);
    } catch (error) {
      log.error("Webhook verification failed", { error, requestId });
      Sentry.captureException(error, {
        tags: { errorType: "verification-failed" },
        level: "warning",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Set context for this webhook
    Sentry.setContext("webhook", {
      eventId: event.id,
      eventType: event.type,
    });

    // Process the webhook
    try {
      await processWebhook(event);
    } catch (error) {
      log.error("Webhook processing failed", { error, eventType: event.type });
      Sentry.captureException(error, {
        tags: {
          errorType: "processing-failed",
          eventType: event.type,
        },
        level: "error",
      });
      // Return 500 so the service retries
      return NextResponse.json(
        { error: "Processing failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true, requestId });
  } catch (error) {
    log.error("Unexpected webhook error", { error, requestId });
    Sentry.captureException(error, {
      tags: { errorType: "unexpected" },
      level: "fatal",
    });
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
```

## Client-Side Error Handling

### Global Error Handler

The `ClientErrorHandler` component is automatically added to the root layout and captures all uncaught client-side errors:

```tsx
// Already set up in src/app/layout.tsx
import { ClientErrorHandler } from "@/components/ClientErrorHandler";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClientErrorHandler />
        {children}
      </body>
    </html>
  );
}
```

### React Error Boundaries

Wrap components that might error to prevent full page crashes:

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function MyPage() {
  return (
    <ErrorBoundary
      context={{
        feature: "dashboard",
        component: "charts"
      }}
    >
      <DashboardCharts />
    </ErrorBoundary>
  );
}
```

**With Custom Fallback:**

```tsx
import { ErrorBoundary, ErrorFallback } from "@/components/ErrorBoundary";

export function MyComponent() {
  return (
    <ErrorBoundary
      context={{ feature: "profile", component: "settings" }}
      fallback={
        <div className="p-4 border border-red-200 bg-red-50">
          <p>Failed to load settings. Please refresh.</p>
        </div>
      }
    >
      <UserSettings />
    </ErrorBoundary>
  );
}
```

**Section Error Boundary (Lightweight):**

```tsx
import { SectionErrorBoundary } from "@/components/ErrorBoundary";

export function Dashboard() {
  return (
    <div>
      <SectionErrorBoundary sectionName="Analytics">
        <AnalyticsWidget />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Activity Feed">
        <ActivityFeed />
      </SectionErrorBoundary>
    </div>
  );
}
```

## Background Job Error Handling

Use the Sentry job wrapper for standalone background jobs:

```typescript
import { wrapJobWithSentry, captureJobCheckpoint } from "@/lib/monitoring/sentry-jobs";

const myJob = wrapJobWithSentry("data-sync", async () => {
  // Checkpoint tracking
  captureJobCheckpoint("data-sync", "started", {
    recordCount: 1000,
  });

  // Your job logic
  const results = await processData();

  captureJobCheckpoint("data-sync", "completed", {
    processed: results.length,
  });

  return results;
});

// Run the job
await myJob();
```

## Best Practices

### 1. Always Set Context

Provide rich context for debugging:

```typescript
Sentry.setContext("operation", {
  userId: user.id,
  operation: "data-import",
  fileSize: file.size,
});

Sentry.setTags({
  feature: "imports",
  importType: "csv",
});
```

### 2. Use Appropriate Error Levels

```typescript
// Warning: Expected errors (rate limits, validation)
Sentry.captureException(error, { level: "warning" });

// Error: Unexpected but recoverable errors
Sentry.captureException(error, { level: "error" });

// Fatal: Critical errors that break functionality
Sentry.captureException(error, { level: "fatal" });
```

### 3. Add Request IDs

Always include request IDs for tracing:

```typescript
const requestId = crypto.randomUUID();
Sentry.setTag("requestId", requestId);
```

### 4. Set User Context

Help identify affected users:

```typescript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});
```

### 5. Use Breadcrumbs for Context

Track important events leading to errors:

```typescript
Sentry.addBreadcrumb({
  category: "payment",
  message: "Initiated payment processing",
  level: "info",
  data: {
    amount: 99.99,
    currency: "USD",
  },
});
```

### 6. Don't Log Sensitive Data

Avoid capturing:
- Passwords
- API keys
- Credit card numbers
- PII (unless necessary and compliant)

The logger already redacts common sensitive fields automatically.

## Testing

### Test Sentry Integration

Visit `/sentry-example-page` for an interactive testing page, or use the API endpoint:

```bash
# Test error event
curl https://your-app.com/api/test-sentry?error=1

# Test fatal event
curl https://your-app.com/api/test-sentry?fatal=1

# Test all event types
curl https://your-app.com/api/test-sentry?all=1
```

### Verify in Development

```typescript
// In your code
console.log("Sentry DSN configured:", !!process.env.NEXT_PUBLIC_SENTRY_DSN);

// Check monitoring status
import { getMonitoringStatus } from "@/lib/monitoring/config";
const status = getMonitoringStatus();
console.log(status);
```

## Monitoring Dashboard

Access your Sentry dashboard to:

1. **View Errors**: See all captured errors with full context
2. **Track Issues**: Group similar errors and track resolution
3. **Monitor Performance**: View transaction traces and bottlenecks
4. **Set Alerts**: Get notified of critical errors
5. **View Releases**: Track errors by deployment

## Support

For issues with Sentry integration:

1. Check environment variables are set correctly
2. Verify DSN format in Sentry dashboard
3. Check browser console for Sentry initialization logs
4. Test using `/api/test-sentry` endpoint
5. Review Sentry dashboard for event delivery

## Reference

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Error Tracking Best Practices](https://docs.sentry.io/product/error-monitoring/)
- [Source Files](../src/lib/monitoring/)
