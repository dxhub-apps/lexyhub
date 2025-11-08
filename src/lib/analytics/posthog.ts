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

    // Fix common host configuration mistake
    // The api_host should be the base domain (e.g., https://eu.posthog.com)
    // NOT the ingestion endpoint (e.g., https://eu.i.posthog.com)
    if (apiHost.includes(".i.posthog.com")) {
      const correctedHost = apiHost.replace(".i.posthog.com", ".posthog.com");
      console.warn(
        "⚠️ PostHog: Incorrect host configuration detected!\n" +
        `   You set: ${apiHost}\n` +
        `   Correcting to: ${correctedHost}\n` +
        "   \n" +
        "   The api_host should be the BASE domain (e.g., https://eu.posthog.com),\n" +
        "   NOT the ingestion endpoint (e.g., https://eu.i.posthog.com).\n" +
        "   The SDK automatically constructs the ingestion endpoint.\n" +
        "   \n" +
        "   Please update NEXT_PUBLIC_POSTHOG_HOST in your environment variables:\n" +
        `   NEXT_PUBLIC_POSTHOG_HOST=${correctedHost}`
      );
      apiHost = correctedHost;
    }

    // Detect host/key mismatch
    const isEuHost = apiHost.includes("eu.posthog.com");
    const isUsHost = apiHost.includes("app.posthog.com") || apiHost.includes("us.posthog.com");

    if (isEuHost || isUsHost) {
      console.log(
        `ℹ️ PostHog: Initializing with ${isEuHost ? "EU" : "US"} instance\n` +
        `   Base host: ${apiHost}\n` +
        `   Ingestion endpoint: ${apiHost.replace("://", "://eu.i.").replace("://app.", "://us.i.")}\n` +
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
              "   This usually means:\n" +
              "   1. Your API key is invalid or expired\n" +
              "   2. You're using a key from a different PostHog instance (US vs EU)\n" +
              "   3. You're using a personal API key instead of a project key\n" +
              "   \n" +
              "   Current configuration:\n" +
              `   - Host: ${apiHost}\n` +
              `   - Key: ${apiKey.substring(0, 8)}...\n` +
              "   \n" +
              "   Solutions:\n" +
              "   1. Verify your API key is correct and from the matching instance\n" +
              `   2. Get your project key from: ${isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}/project/settings\n` +
              "   3. Ensure NEXT_PUBLIC_POSTHOG_KEY starts with 'phc_'\n" +
              `   4. Ensure NEXT_PUBLIC_POSTHOG_HOST is: ${isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}\n` +
              "   \n" +
              "   After updating, redeploy your application or restart your dev server."
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
