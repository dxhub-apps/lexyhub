/**
 * Monitoring Configuration Status
 *
 * Provides utilities to check the status of monitoring services (Sentry & PostHog)
 * and display helpful configuration messages.
 */

import { isPostHogReady } from "@/lib/analytics/posthog";

/**
 * Check if Sentry is configured
 */
export function isSentryConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN;
}

/**
 * Check if PostHog is configured
 */
export function isPostHogConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

/**
 * Get monitoring status for all services
 */
export function getMonitoringStatus() {
  const sentryConfigured = isSentryConfigured();
  const posthogConfigured = isPostHogConfigured();

  return {
    sentry: {
      configured: sentryConfigured,
      dsn: sentryConfigured ? process.env.NEXT_PUBLIC_SENTRY_DSN : null,
    },
    posthog: {
      configured: posthogConfigured,
      ready: isPostHogReady(),
      key: posthogConfigured ? "***" + process.env.NEXT_PUBLIC_POSTHOG_KEY?.slice(-4) : null,
    },
    allConfigured: sentryConfigured && posthogConfigured,
  };
}

/**
 * Print monitoring configuration status (for debugging)
 */
export function logMonitoringStatus() {
  const status = getMonitoringStatus();

  console.group("🔍 Monitoring Configuration Status");

  console.log(
    `Sentry: ${status.sentry.configured ? "✅ Configured" : "❌ Not Configured"}`
  );
  if (status.sentry.configured) {
    console.log(`  DSN: ${status.sentry.dsn?.slice(0, 30)}...`);
  }

  console.log(
    `PostHog: ${status.posthog.configured ? "✅ Configured" : "❌ Not Configured"}`
  );
  if (status.posthog.configured) {
    console.log(`  Key: ${status.posthog.key}`);
    console.log(`  Ready: ${status.posthog.ready ? "✅" : "⏳ Initializing..."}`);
  }

  if (!status.allConfigured) {
    console.log("\n⚠️ To enable all monitoring features:");
    if (!status.sentry.configured) {
      console.log("  1. Add NEXT_PUBLIC_SENTRY_DSN to .env.local");
      console.log("     Get your DSN from: https://sentry.io/settings/projects/");
    }
    if (!status.posthog.configured) {
      console.log("  2. Add NEXT_PUBLIC_POSTHOG_KEY to .env.local");
      console.log("     Get your key from: https://app.posthog.com/project/settings");
    }
  } else {
    console.log("\n✅ All monitoring services configured!");
  }

  console.groupEnd();
}

/**
 * Environment variable validation
 */
export function validateMonitoringEnv(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    warnings.push("NEXT_PUBLIC_SENTRY_DSN is not set - Sentry error tracking disabled");
  }

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    warnings.push("NEXT_PUBLIC_POSTHOG_KEY is not set - PostHog analytics disabled");
  }

  // Validate Sentry DSN format if provided
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    const dsnPattern = /^https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+$/;
    if (!dsnPattern.test(process.env.NEXT_PUBLIC_SENTRY_DSN)) {
      errors.push("NEXT_PUBLIC_SENTRY_DSN appears to be invalid");
    }
  }

  // Validate PostHog key format if provided
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY.startsWith("phc_")) {
      warnings.push("NEXT_PUBLIC_POSTHOG_KEY should start with 'phc_'");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
