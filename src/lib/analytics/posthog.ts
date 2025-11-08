/**
 * PostHog Analytics Integration
 *
 * Configuration:
 * - NEXT_PUBLIC_POSTHOG_KEY: Project API key (starts with 'phc_')
 * - NEXT_PUBLIC_POSTHOG_HOST: Ingestion endpoint
 *   * US: https://us.i.posthog.com
 *   * EU: https://eu.i.posthog.com
 *
 * Get your project key from: https://app.posthog.com/project/settings (US)
 *                        or: https://eu.posthog.com/project/settings (EU)
 */
import posthog from "posthog-js";

let isInitialized = false;

export function initPostHog() {
  if (typeof window !== "undefined" && !isInitialized) {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    let apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

    // Log configuration for debugging (in development)
    if (process.env.NODE_ENV === "development") {
      console.log(
        "🔧 PostHog Configuration:\n" +
        `   API Key: ${apiKey ? apiKey.substring(0, 8) + "..." : "NOT SET"}\n` +
        `   API Host: ${apiHost}\n` +
        `   Environment: ${process.env.NODE_ENV}`
      );
    }

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

    // Detect PostHog instance (US or EU) for targeted error messages
    const isEuHost = apiHost.includes("eu.") && apiHost.includes("posthog.com");
    const isUsHost = (apiHost.includes("app.posthog.com") || apiHost.includes("us.")) && apiHost.includes("posthog.com");

    if (isEuHost || isUsHost) {
      console.log(
        `ℹ️ PostHog: Initializing with ${isEuHost ? "EU" : "US"} instance\n` +
        `   API Host: ${apiHost}\n` +
        `   API Key: ${apiKey.substring(0, 12)}...\n` +
        "   Ensure your API key is from this PostHog instance."
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
              "   \n" +
              "   Your configuration appears correct, but PostHog is rejecting the API key.\n" +
              "   \n" +
              "   Current configuration:\n" +
              `   - Host: ${apiHost} (${isEuHost ? 'EU' : 'US'} instance)\n` +
              `   - Key: ${apiKey.substring(0, 8)}... (format is correct)\n` +
              "   \n" +
              "   Common causes:\n" +
              "   1. The API key is from a DIFFERENT PostHog instance\n" +
              `      → Check if your key is from the ${isEuHost ? 'US' : 'EU'} instance instead\n` +
              "   2. The API key has been revoked or the project deleted\n" +
              "   3. You copied the wrong key (e.g., personal API key renamed to start with 'phc_')\n" +
              "   \n" +
              "   To fix:\n" +
              `   1. Log into: ${isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}\n` +
              "   2. Go to: Project Settings → Project API Key\n" +
              "   3. Copy the EXACT key shown (starts with 'phc_')\n" +
              "   4. Update NEXT_PUBLIC_POSTHOG_KEY in your environment variables\n" +
              "   5. Redeploy your application\n" +
              "   \n" +
              "   If the key is definitely correct, try creating a NEW project key."
            );
          } else if (err?.status === 403 || err?.statusCode === 403) {
            console.error(
              "❌ PostHog: Access forbidden (403)\n" +
              "   Your API key doesn't have permission to send events.\n" +
              "   Ensure you're using a project key, not a personal API key.\n" +
              `   Get your project key from: ${isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}/project/settings`
            );
          } else if (err?.status === 400 || err?.statusCode === 400) {
            console.error(
              "❌ PostHog: Bad request (400)\n" +
              "   The request format is invalid. This might indicate a configuration issue.\n" +
              `   Current host: ${apiHost}`
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
