"use client";

import { posthog } from "./posthog";
import * as Sentry from "@sentry/nextjs";

/**
 * Hook to access PostHog for event tracking
 */
export function usePostHog() {
  return posthog;
}

/**
 * Track a custom event with PostHog
 */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (posthog) {
    posthog.capture(eventName, properties);
  }
}

/**
 * Identify a user in PostHog and Sentry
 */
export function identifyUser(userId: string, traits?: Record<string, any>) {
  // PostHog identification
  if (posthog) {
    posthog.identify(userId, traits);
  }

  // Sentry identification
  Sentry.setUser({
    id: userId,
    ...traits,
  });
}

/**
 * Reset user identification (on logout)
 */
export function resetUser() {
  // PostHog reset
  if (posthog) {
    posthog.reset();
  }

  // Sentry reset
  Sentry.setUser(null);
}

/**
 * Track a feature flag evaluation
 */
export function trackFeatureFlag(flagName: string, value: any, properties?: Record<string, any>) {
  trackEvent("feature_flag_evaluated", {
    flag_name: flagName,
    flag_value: value,
    ...properties,
  });
}

/**
 * Set user properties (without identifying)
 */
export function setUserProperties(properties: Record<string, any>) {
  if (posthog) {
    posthog.setPersonProperties(properties);
  }
}

/**
 * Track a page view (usually handled automatically, but useful for custom tracking)
 */
export function trackPageView(url?: string, properties?: Record<string, any>) {
  if (posthog) {
    posthog.capture("$pageview", {
      $current_url: url || window.location.href,
      ...properties,
    });
  }
}

/**
 * Capture an error in Sentry with additional context
 */
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info", context?: Record<string, any>) {
  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Add breadcrumb to Sentry
 */
export function addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
  Sentry.addBreadcrumb(breadcrumb);
}

/**
 * Set context for Sentry
 */
export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

/**
 * Start a Sentry transaction for performance monitoring
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({ name, op }, () => {
    // Return a function that can be called to finish the span
    return () => {};
  });
}
