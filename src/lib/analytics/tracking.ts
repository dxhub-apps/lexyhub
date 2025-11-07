/**
 * Analytics Tracking Helper
 *
 * Centralized tracking utilities for user events across the application.
 * Integrates with PostHog and Sentry for comprehensive analytics and error tracking.
 */

import { getPostHog, isPostHogReady } from "./posthog";
import * as Sentry from "@sentry/nextjs";

/**
 * Standard event names for consistent tracking
 */
export const AnalyticsEvents = {
  // User Authentication
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",
  USER_PROFILE_UPDATED: "user_profile_updated",

  // Billing & Subscription
  SUBSCRIPTION_STARTED: "subscription_started",
  SUBSCRIPTION_UPGRADED: "subscription_upgraded",
  SUBSCRIPTION_CANCELED: "subscription_canceled",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",

  // Product Features
  KEYWORD_SEARCHED: "keyword_searched",
  KEYWORD_ADDED_TO_WATCHLIST: "keyword_added_to_watchlist",
  KEYWORD_REMOVED_FROM_WATCHLIST: "keyword_removed_from_watchlist",
  TREND_VIEWED: "trend_viewed",
  COMPETITOR_ANALYZED: "competitor_analyzed",
  REPORT_GENERATED: "report_generated",
  REPORT_EXPORTED: "report_exported",

  // Integrations
  ETSY_CONNECTED: "etsy_connected",
  ETSY_DISCONNECTED: "etsy_disconnected",
  PINTEREST_CONNECTED: "pinterest_connected",
  REDDIT_CONNECTED: "reddit_connected",

  // Data Operations
  DATA_IMPORT_STARTED: "data_import_started",
  DATA_IMPORT_COMPLETED: "data_import_completed",
  DATA_IMPORT_FAILED: "data_import_failed",

  // Browser Extension
  EXTENSION_INSTALLED: "extension_installed",
  EXTENSION_DATA_SYNCED: "extension_data_synced",

  // Errors & Issues
  ERROR_OCCURRED: "error_occurred",
  API_ERROR: "api_error",

  // Navigation
  PAGE_VIEWED: "page_viewed",
  FEATURE_DISCOVERED: "feature_discovered",

  // Engagement
  HELP_VIEWED: "help_viewed",
  FEEDBACK_SUBMITTED: "feedback_submitted",
  TUTORIAL_STARTED: "tutorial_started",
  TUTORIAL_COMPLETED: "tutorial_completed",
} as const;

/**
 * Track a standard analytics event
 */
export function trackAnalyticsEvent(
  eventName: string,
  properties?: Record<string, any>
) {
  if (typeof window === "undefined") return;

  try {
    const posthog = getPostHog();
    if (posthog && isPostHogReady()) {
      posthog.capture(eventName, properties);
    }

    // For important events, also add a breadcrumb in Sentry
    if (isImportantEvent(eventName)) {
      Sentry.addBreadcrumb({
        category: "analytics",
        message: eventName,
        data: properties,
        level: "info",
      });
    }
  } catch (error) {
    console.error("Failed to track analytics event:", error);
  }
}

/**
 * Identify a user with their profile information
 */
export function identifyAnalyticsUser(
  userId: string,
  traits?: {
    email?: string;
    name?: string;
    plan?: string;
    createdAt?: string;
    [key: string]: any;
  }
) {
  if (typeof window === "undefined") return;

  try {
    // PostHog identification
    const posthog = getPostHog();
    if (posthog && isPostHogReady()) {
      posthog.identify(userId, traits);
    }

    // Sentry identification
    Sentry.setUser({
      id: userId,
      email: traits?.email,
      username: traits?.name,
      ...traits,
    });
  } catch (error) {
    console.error("Failed to identify user:", error);
  }
}

/**
 * Reset user identification (call on logout)
 */
export function resetAnalyticsUser() {
  if (typeof window === "undefined") return;

  try {
    const posthog = getPostHog();
    if (posthog && isPostHogReady()) {
      posthog.reset();
    }

    Sentry.setUser(null);
  } catch (error) {
    console.error("Failed to reset user:", error);
  }
}

/**
 * Track a page view
 */
export function trackPageView(pageName: string, properties?: Record<string, any>) {
  trackAnalyticsEvent(AnalyticsEvents.PAGE_VIEWED, {
    page_name: pageName,
    ...properties,
  });
}

/**
 * Track an error event
 */
export function trackError(
  error: Error | string,
  context?: Record<string, any>
) {
  const errorMessage = typeof error === "string" ? error : error.message;

  trackAnalyticsEvent(AnalyticsEvents.ERROR_OCCURRED, {
    error_message: errorMessage,
    ...context,
  });

  // Also capture in Sentry if it's an Error object
  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Track a feature flag evaluation
 */
export function trackFeatureFlag(
  flagName: string,
  value: any,
  properties?: Record<string, any>
) {
  trackAnalyticsEvent("feature_flag_evaluated", {
    flag_name: flagName,
    flag_value: value,
    ...properties,
  });
}

/**
 * Set user properties without identifying
 */
export function setAnalyticsUserProperties(properties: Record<string, any>) {
  if (typeof window === "undefined") return;

  try {
    const posthog = getPostHog();
    if (posthog && isPostHogReady()) {
      posthog.setPersonProperties(properties);
    }
  } catch (error) {
    console.error("Failed to set user properties:", error);
  }
}

/**
 * Track a conversion event (for paid features, upgrades, etc.)
 */
export function trackConversion(
  eventName: string,
  value?: number,
  properties?: Record<string, any>
) {
  trackAnalyticsEvent(eventName, {
    ...properties,
    value,
  });
}

/**
 * Helper to determine if an event should be tracked in Sentry breadcrumbs
 */
function isImportantEvent(eventName: string): boolean {
  const importantEvents = [
    AnalyticsEvents.USER_SIGNED_UP,
    AnalyticsEvents.USER_LOGGED_IN,
    AnalyticsEvents.SUBSCRIPTION_STARTED,
    AnalyticsEvents.PAYMENT_COMPLETED,
    AnalyticsEvents.ERROR_OCCURRED,
    AnalyticsEvents.API_ERROR,
  ];

  return importantEvents.includes(eventName as any);
}

/**
 * Track timing for performance monitoring
 */
export function trackTiming(
  category: string,
  variable: string,
  time: number,
  label?: string
) {
  trackAnalyticsEvent("timing", {
    category,
    variable,
    time,
    label,
  });
}

/**
 * Group users by organization or team
 */
export function groupAnalyticsUser(
  groupType: string,
  groupId: string,
  properties?: Record<string, any>
) {
  if (typeof window === "undefined") return;

  try {
    const posthog = getPostHog();
    if (posthog && isPostHogReady()) {
      posthog.group(groupType, groupId, properties);
    }
  } catch (error) {
    console.error("Failed to group user:", error);
  }
}
