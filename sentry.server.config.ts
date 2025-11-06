import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

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

  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Server-specific integrations
  integrations: [
    Sentry.httpIntegration(),
    Sentry.prismaIntegration(),
    Sentry.postgresIntegration(),
  ],

  // Configure scope to include useful server-side context
  beforeSend(event, hint) {
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
