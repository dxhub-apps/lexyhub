import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Log Sentry configuration status (only once during server startup)
console.group("🔍 Sentry Server Configuration");
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

  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps

  environment: process.env.NODE_ENV,

  // Only disable if explicitly set to false, otherwise enable for testing
  enabled: SENTRY_DSN !== undefined && SENTRY_DSN !== "",

  // Server-specific integrations
  integrations: [
    Sentry.httpIntegration(),
    Sentry.prismaIntegration(),
    Sentry.postgresIntegration(),
  ],

  // Configure scope to include useful server-side context
  beforeSend(event, hint) {
    // Log event being sent (only in development)
    if (process.env.NODE_ENV === "development") {
      console.log("📤 Sentry server: Sending event", {
        type: event.type,
        level: event.level,
        message: event.message || event.exception?.values?.[0]?.value,
      });
    }

    // Add additional context for server-side errors
    if (event.request) {
      // Sanitize sensitive headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
    }
    return event;
  },
});

// Log initialization result
if (SENTRY_DSN) {
  console.log("✅ Sentry server initialized successfully");
  console.log("   - Traces Sample Rate:", process.env.NODE_ENV === "production" ? "10%" : "100%");
  console.log("   - Integrations: HTTP, Prisma, Postgres");
} else {
  console.log("❌ Sentry server is DISABLED (no DSN configured)");
}
