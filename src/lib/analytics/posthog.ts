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

    // Trim the API key to remove any accidental whitespace
    const trimmedApiKey = apiKey.trim();

    // Validate API key format
    if (!trimmedApiKey.startsWith("phc_")) {
      console.error(
        "❌ PostHog: Invalid API key format. PostHog project keys should start with 'phc_'.\n" +
        "You may be using a personal API key instead of a project key.\n" +
        "Get your project key from: https://app.posthog.com/project/settings"
      );
      return null;
    }

    // Check for common configuration mistakes
    if (trimmedApiKey !== apiKey) {
      console.warn(
        "⚠️ PostHog: API key had leading/trailing whitespace that was trimmed.\n" +
        "   Please update your environment variable to remove the whitespace."
      );
    }

    // Validate host format
    if (!apiHost.startsWith("http://") && !apiHost.startsWith("https://")) {
      console.error(
        "❌ PostHog: Invalid host format. Host must start with http:// or https://\n" +
        `   Current value: ${apiHost}`
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
        `   API Key: ${trimmedApiKey.substring(0, 12)}...\n` +
        "   Ensure your API key is from this PostHog instance."
      );
    }

    try {
      posthog.init(trimmedApiKey, {
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
              `   - Host: ${apiHost} (${isEuHost ? 'EU' : isUsHost ? 'US' : 'Unknown'} instance)\n` +
              `   - Key: ${trimmedApiKey.substring(0, 8)}...${trimmedApiKey.substring(trimmedApiKey.length - 4)} (format is correct)\n` +
              "   \n" +
              "   Common causes:\n" +
              "   1. The API key is from a DIFFERENT PostHog instance\n" +
              `      → Your host is set to ${isEuHost ? 'EU' : isUsHost ? 'US' : 'custom'} instance\n` +
              `      → Verify your key is from: ${isEuHost ? 'https://eu.posthog.com' : isUsHost ? 'https://app.posthog.com' : apiHost}\n` +
              "      → Check: Project Settings → Project API Key\n" +
              "   \n" +
              "   2. STALE VERCEL DEPLOYMENT (most common!)\n" +
              "      → Environment variables updated but old build is cached\n" +
              "      → Fix: Redeploy in Vercel to pick up new variables\n" +
              "      → Or: Settings → Clear Build Cache → Redeploy\n" +
              "   \n" +
              "   3. INVALID/REVOKED KEY\n" +
              "      → The key may have been revoked or project deleted\n" +
              "      → Try creating a NEW project API key in PostHog\n" +
              "   \n" +
              "   To debug:\n" +
              "   1. Visit /api/debug/posthog to test your API key\n" +
              "   2. Add <PostHogDebugger /> component to your page\n" +
              "   3. Check if server-side key matches client-side key"
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
