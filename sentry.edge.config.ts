import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Warn if Sentry is not configured
if (!SENTRY_DSN) {
  console.warn(
    "⚠️ Sentry: NEXT_PUBLIC_SENTRY_DSN is not set. Error tracking will not be enabled.\n" +
    "To enable Sentry, add NEXT_PUBLIC_SENTRY_DSN to your .env.local file.\n" +
    "Get your DSN from: https://sentry.io/settings/projects/"
  );
}

Sentry.init({
  dsn: SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps

  environment: process.env.NODE_ENV,

  // Only disable if explicitly set to false, otherwise enable for testing
  enabled: SENTRY_DSN !== undefined && SENTRY_DSN !== "",
});

// Log successful initialization in development
if (SENTRY_DSN && process.env.NODE_ENV === "development") {
  console.log("✅ Sentry edge initialized successfully");
}
