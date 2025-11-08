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

    // Validate API key format
    if (!apiKey.startsWith("phc_")) {
      console.error(
        "❌ PostHog: Invalid API key format. PostHog project keys should start with 'phc_'.\n" +
        "You may be using a personal API key instead of a project key.\n" +
        "Get your project key from: https://app.posthog.com/project/settings"
      );
      return null;
    }

    // Detect host/key mismatch
    const isEuHost = apiHost.includes("eu.posthog.com");
    const isUsHost = apiHost.includes("app.posthog.com") || apiHost.includes("us.posthog.com");

    if (isEuHost || isUsHost) {
      console.log(
        `ℹ️ PostHog: Using ${isEuHost ? "EU" : "US"} instance (${apiHost})\n` +
        "   Ensure your API key matches this instance."
      );
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

        // Error handling for failed requests
        on_request_error: (error) => {
          const err = error as any;
          if (err?.status === 401 || err?.statusCode === 401) {
            console.error(
              "❌ PostHog: Authentication failed (401 Unauthorized)\n" +
              "   This usually means:\n" +
              "   1. Your API key is invalid or expired\n" +
              "   2. You're using a key from a different PostHog instance\n" +
              "   3. You're using a personal API key instead of a project key\n" +
              `   Current host: ${apiHost}\n` +
              "   Solution: Check your NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST\n" +
              "   Get your project key from: https://app.posthog.com/project/settings"
            );
          } else if (err?.status === 403 || err?.statusCode === 403) {
            console.error(
              "❌ PostHog: Access forbidden (403)\n" +
              "   Your API key doesn't have permission to send events.\n" +
              "   Ensure you're using a project key, not a personal API key."
            );
          }
        },

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
