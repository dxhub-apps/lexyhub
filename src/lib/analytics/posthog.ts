import posthog from "posthog-js";

let isInitialized = false;

export function initPostHog() {
  if (typeof window !== "undefined" && !isInitialized) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

    if (!apiKey) {
      console.warn(
        "⚠️ PostHog: NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics will not be tracked.\n" +
        "To enable PostHog, add NEXT_PUBLIC_POSTHOG_KEY to your .env.local file."
      );
      return null;
    }

    try {
      posthog.init(apiKey, {
        api_host: apiHost,

        // Enable debug mode in development
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            console.log("✅ PostHog initialized successfully");
            posthog.debug();
          }
        },

        // Capture pageviews and performance automatically
        capture_pageview: true,
        capture_pageleave: true,

        // Session recording
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: '[data-private]',
        },

        // Autocapture settings
        autocapture: {
          dom_event_allowlist: ['click', 'submit'],
          capture_copied_text: true,
        },

        // Performance monitoring
        enable_recording_console_log: process.env.NODE_ENV === "development",

        // Respect user preferences
        opt_out_capturing_by_default: false,
        respect_dnt: true,

        // Advanced options
        sanitize_properties: (properties, event) => {
          // Remove sensitive data
          const sensitiveKeys = ['password', 'token', 'api_key', 'secret'];
          const sanitized = { ...properties };

          Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
              delete sanitized[key];
            }
          });

          return sanitized;
        },
      });

      isInitialized = true;
      console.log("✅ PostHog analytics enabled");
    } catch (error) {
      console.error("❌ PostHog initialization failed:", error);
      return null;
    }
  }

  return posthog;
}

/**
 * Get the PostHog instance (safe to use after initialization)
 */
export function getPostHog() {
  if (typeof window === "undefined") {
    return null;
  }
  return isInitialized ? posthog : null;
}

/**
 * Check if PostHog is initialized and ready to use
 */
export function isPostHogReady(): boolean {
  return isInitialized && typeof window !== "undefined";
}

// Export for backward compatibility, but prefer using getPostHog()
export { posthog };
