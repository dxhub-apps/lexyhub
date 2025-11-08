import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Log Sentry configuration status
console.group("🔍 Sentry Client Configuration");
console.log("Environment:", process.env.NODE_ENV);
console.log("DSN Configured:", !!SENTRY_DSN);
if (SENTRY_DSN) {
  console.log("DSN Preview:", SENTRY_DSN.substring(0, 40) + "...");
} else {
  console.warn(
    "⚠️ NEXT_PUBLIC_SENTRY_DSN is not set. Error tracking will not be enabled.\n" +
    "To enable Sentry:\n" +
    "1. Create .env.local file in project root\n" +
    "2. Add: NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id\n" +
    "3. Get your DSN from: https://sentry.io/settings/projects/"
  );
}
console.groupEnd();

Sentry.init({
  dsn: SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Set profilesSampleRate to capture 10% of all transactions for profiling
  // This is relative to tracesSampleRate
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions,
  // plus 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps

  environment: process.env.NODE_ENV,

  // Only disable if explicitly set to false, otherwise enable for testing
  enabled: SENTRY_DSN !== undefined && SENTRY_DSN !== "",

  // Configure integrations
  integrations: [
    Sentry.replayIntegration({
      // Additional SDK configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filtering out known noisy errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    "chrome-extension://",
    "moz-extension://",
    // Random plugins/extensions
    "fb_xd_fragment",
    // Network errors
    "NetworkError",
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // ResizeObserver errors (can be noisy and not critical)
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
  ],

  beforeSend(event, hint) {
    // Filter out errors from browser extensions
    if (event.exception?.values?.[0]?.stacktrace?.frames) {
      const frames = event.exception.values[0].stacktrace.frames;
      if (frames.some(frame => frame.filename?.includes('extension://'))) {
        return null;
      }
    }
    return event;
  },
});

// Log initialization result
if (SENTRY_DSN) {
  console.log("✅ Sentry client initialized successfully");
  console.log("   - Traces Sample Rate:", process.env.NODE_ENV === "production" ? "10%" : "100%");
  console.log("   - Replays Session Sample Rate:", "10%");
  console.log("   - Replays On Error Sample Rate:", "100%");

  // Test connection with a debug message (only in development)
  if (process.env.NODE_ENV === "development") {
    console.log("📤 To test Sentry, visit: /api/test-sentry");
  }
} else {
  console.log("❌ Sentry client is DISABLED (no DSN configured)");
}
