/**
 * PostHog Analytics Integration
 *
 * Configuration:
 * - NEXT_PUBLIC_POSTHOG_KEY: Project API key (starts with 'phc_')
 * - NEXT_PUBLIC_POSTHOG_HOST: Ingestion endpoint (https://eu.i.posthog.com)
 *
 * IMPORTANT: This uses a single, locked PostHog client.
 * No fallback logic, no host switching, no retries.
 */
import posthog from "posthog-js";

let isInitialized = false;
let isInitializing = false;

// Prevent multiple initializations or config mutations
const INIT_LOCK = { locked: false };

export function initPostHog() {
  if (typeof window === "undefined") {
    return null;
  }

  // Prevent duplicate initialization
  if (isInitialized || isInitializing || INIT_LOCK.locked) {
    if (process.env.NODE_ENV === "development") {
      console.log("PostHog: Already initialized, using existing instance");
    }
    return posthog;
  }

  // Lock to prevent race conditions
  INIT_LOCK.locked = true;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  // Log configuration for debugging (in development)
  if (process.env.NODE_ENV === "development") {
    console.log(
      "🔧 PostHog Configuration:\n" +
      `   API Key: ${apiKey ? apiKey.substring(0, 8) + "..." : "NOT SET"}\n` +
      `   API Host: ${apiHost || "NOT SET"}\n` +
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

  if (!apiHost) {
    console.error(
      "❌ PostHog: NEXT_PUBLIC_POSTHOG_HOST is not set. Analytics will not be tracked.\n" +
      "To enable PostHog, add NEXT_PUBLIC_POSTHOG_HOST to your .env.local file.\n" +
      "   Expected: NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com"
    );
    INIT_LOCK.locked = false;
    return null;
  }

  // Trim the API key to remove any accidental whitespace
  const trimmedApiKey = apiKey.trim();

  // Validate API key format
  if (!trimmedApiKey.startsWith("phc_")) {
    console.error(
      "❌ PostHog: Invalid API key format. PostHog project keys should start with 'phc_'.\n" +
      "You may be using a personal API key instead of a project key.\n" +
      "Get your project key from: https://eu.posthog.com/project/settings"
    );
    INIT_LOCK.locked = false;
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
    INIT_LOCK.locked = false;
    return null;
  }

  // Verify we're using EU instance
  if (!apiHost.includes("eu.i.posthog.com")) {
    console.warn(
      "⚠️ PostHog: Expected EU instance (https://eu.i.posthog.com)\n" +
      `   Current value: ${apiHost}\n` +
      "   Continuing with provided host..."
    );
  }

  const normalizedHost = normalizeHost(apiHost);

  isInitializing = true;

  console.log(
    `ℹ️ PostHog: Initializing with locked configuration\n` +
    `   API Host: ${normalizedHost}\n` +
    `   API Key: ${trimmedApiKey.substring(0, 12)}...${trimmedApiKey.substring(trimmedApiKey.length - 4)}`
  );

  try {
    posthog.init(
      trimmedApiKey,
      createPostHogOptions(normalizedHost, trimmedApiKey)
    );

    isInitialized = true;

    // DEBUG: Verify the key was stored
    console.log("✅ PostHog analytics enabled (single client, no fallback)");
    console.log("🔍 DEBUG: PostHog config after init:", {
      token: posthog.config?.token,
      api_host: posthog.config?.api_host,
      token_matches: posthog.config?.token === trimmedApiKey
    });

    if (posthog.config?.token !== trimmedApiKey) {
      console.error("❌ CRITICAL: PostHog token mismatch after init!");
      console.error("   Expected:", trimmedApiKey);
      console.error("   Got:", posthog.config?.token);
    }
  } catch (error) {
    console.error("❌ PostHog initialization failed:", error);
    isInitializing = false;
    INIT_LOCK.locked = false;
    return null;
  }

  isInitializing = false;
  return posthog;
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function createPostHogOptions(apiHost: string, apiKey: string) {
  return {
    api_host: apiHost,

    // Enable debug mode in development
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ PostHog initialized successfully");
        client.debug();
      }
    },

    // Capture pageviews and performance automatically
    capture_pageview: true,
    capture_pageleave: true,

    // Session recording - TEMPORARILY DISABLED for debugging
    disable_session_recording: true,
    // session_recording: {
    //   maskAllInputs: true,
    //   maskTextSelector: '[data-private]',
    // },

    // Autocapture settings
    autocapture: {
      dom_event_allowlist: ["click", "submit"],
      capture_copied_text: true,
    },

    // Performance monitoring
    enable_recording_console_log: process.env.NODE_ENV === "development",

    // Respect user preferences
    opt_out_capturing_by_default: false,
    respect_dnt: true,

    // Error handling for failed requests - NO RETRIES, NO FALLBACK
    on_request_error: (error: any) => {
      const status = error?.status ?? error?.statusCode;

      if (status === 401) {
        console.error(
          "❌ PostHog: 401 Unauthorized\n" +
            `   Host: ${apiHost}\n` +
            `   Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}\n` +
            "\n" +
            "   Possible causes:\n" +
            "   1. API key doesn't match the host instance\n" +
            "   2. Stale Vercel build cache - redeploy to pick up new env vars\n" +
            "   3. Invalid or revoked API key\n" +
            "\n" +
            "   Debug at: /api/debug/posthog"
        );
      } else if (status === 403) {
        console.error(
          "❌ PostHog: 403 Forbidden - Check your API key permissions"
        );
      } else if (status === 400) {
        console.error(
          "❌ PostHog: 400 Bad Request - Invalid request format"
        );
      }
    },

    // Advanced options
    sanitize_properties: (properties) => {
      // Remove sensitive data
      const sensitiveKeys = ["password", "token", "api_key", "secret"];
      const sanitized = { ...properties };

      Object.keys(sanitized).forEach((key) => {
        if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
          delete sanitized[key];
        }
      });

      return sanitized;
    },
  } as Parameters<typeof posthog.init>[1];
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
