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
let isInitializing = false;

export function initPostHog() {
  if (typeof window === "undefined") {
    return null;
  }

  if (isInitialized || isInitializing) {
    return posthog;
  }

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
      "   For EU instance: NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com\n" +
      "   For US instance: NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com"
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

  const normalizedHost = normalizeHost(apiHost);
  const hostMeta = analyzeHost(normalizedHost);

  const fallbackState: FallbackState = {
    attemptedFallback: false,
    originalHost: normalizedHost,
    trimmedApiKey,
  };

  const initWithHost = (meta: HostMetadata, isFallback = false) => {
    isInitializing = true;

    if (meta.isEuHost || meta.isUsHost) {
      console.log(
        `ℹ️ PostHog: Initializing with ${meta.label} instance${isFallback ? " (fallback attempt)" : ""}\n` +
        `   API Host: ${meta.host}\n` +
        `   API Key: ${trimmedApiKey.substring(0, 12)}...${trimmedApiKey.substring(trimmedApiKey.length - 4)}\n` +
        "   Ensure your API key is from this PostHog instance."
      );
    } else {
      console.log(
        `ℹ️ PostHog: Initializing with custom PostHog host ${meta.host}${isFallback ? " (fallback attempt)" : ""}`
      );
    }

    try {
      posthog.init(
        trimmedApiKey,
        createPostHogOptions({
          meta,
          trimmedApiKey,
          fallbackState,
          onFallback: (nextHost) => initWithHost(analyzeHost(nextHost), true),
        })
      );

      isInitialized = true;
      fallbackState.lastKnownWorkingHost = meta.host;
      console.log(
        `✅ PostHog analytics enabled${isFallback ? " using fallback host" : ""}`
      );
      if (isFallback) {
        console.warn(
          `⚠️ PostHog fallback host active. Update NEXT_PUBLIC_POSTHOG_HOST to ${meta.host} to avoid future automatic retries.`
        );
      }
    } catch (error) {
      console.error("❌ PostHog initialization failed:", error);
      isInitializing = false;
      return null;
    }

    isInitializing = false;
    return posthog;
  };

  return initWithHost(hostMeta);
}

type HostMetadata = {
  host: string;
  isEuHost: boolean;
  isUsHost: boolean;
  label: "EU" | "US" | "custom";
  fallbackHost: string | null;
};

type FallbackState = {
  attemptedFallback: boolean;
  originalHost: string;
  trimmedApiKey: string;
  lastKnownWorkingHost?: string;
};

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, "");
}

function analyzeHost(rawHost: string): HostMetadata {
  const host = normalizeHost(rawHost);
  const isEuHost = host.includes("eu.") && host.includes("posthog.com");
  const isUsHost =
    (host.includes("app.posthog.com") || host.includes("us.")) && host.includes("posthog.com");

  let label: HostMetadata["label"] = "custom";
  if (isEuHost) {
    label = "EU";
  } else if (isUsHost) {
    label = "US";
  }

  let fallbackHost: string | null = null;
  if (label === "EU") {
    fallbackHost = "https://us.i.posthog.com";
  } else if (label === "US") {
    fallbackHost = "https://eu.i.posthog.com";
  }

  return { host, isEuHost, isUsHost, label, fallbackHost };
}

type CreatePostHogOptionsParams = {
  meta: HostMetadata;
  trimmedApiKey: string;
  fallbackState: FallbackState;
  onFallback: (nextHost: string) => void;
};

function createPostHogOptions({
  meta,
  trimmedApiKey,
  fallbackState,
  onFallback,
}: CreatePostHogOptionsParams) {
  const regionLabel = meta.label === "EU" ? "EU" : meta.label === "US" ? "US" : "custom";
  const keyPreview = `${trimmedApiKey.substring(0, 8)}...${trimmedApiKey.substring(trimmedApiKey.length - 4)}`;

  return {
    api_host: meta.host,

    // Enable debug mode in development
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        const suffix =
          fallbackState.attemptedFallback && meta.host !== fallbackState.originalHost
            ? " (fallback host)"
            : "";
        console.log(`✅ PostHog initialized successfully${suffix}`);
        client.debug();
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
      dom_event_allowlist: ["click", "submit"],
      capture_copied_text: true,
    },

    // Performance monitoring
    enable_recording_console_log: process.env.NODE_ENV === "development",

    // Respect user preferences
    opt_out_capturing_by_default: false,
    respect_dnt: true,

    // Error handling for failed requests
    on_request_error: (error: any) => {
      const status = error?.status ?? error?.statusCode;

      if (status === 401) {
        console.error(
          "❌ PostHog: Authentication failed (401 Unauthorized)\n" +
            "   \n" +
            "   Your configuration appears correct, but PostHog is rejecting the API key.\n" +
            "   \n" +
            "   Current configuration:\n" +
            `   - Host: ${meta.host} (${regionLabel} instance)\n` +
            `   - Key: ${keyPreview} (format is correct)\n` +
            "   \n" +
            "   Common causes:\n" +
            "   1. The API key is from a DIFFERENT PostHog instance\n" +
            `      → Your host is set to ${regionLabel} instance\n` +
            `      → Verify your key is from: ${regionLabel === 'EU' ? 'https://eu.posthog.com' : regionLabel === 'US' ? 'https://app.posthog.com' : meta.host}\n` +
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
            "   3. Check if server-side key matches client-side key" +
            (meta.fallbackHost && !fallbackState.attemptedFallback
              ? `\n   \n   Automatic fix: Retrying with ${meta.fallbackHost} in case your key belongs to the other PostHog region.`
              : "")
        );

        if (!fallbackState.attemptedFallback && meta.fallbackHost) {
          fallbackState.attemptedFallback = true;
          console.warn(
            `⚠️ PostHog: ${meta.host} rejected the API key. Retrying automatically with ${meta.fallbackHost}.`
          );
          onFallback(meta.fallbackHost);
          return;
        }

        if (fallbackState.attemptedFallback && meta.host !== fallbackState.originalHost) {
          console.error(
            `❌ PostHog: Both ${fallbackState.originalHost} and ${meta.host} rejected the API key. Generate a new project API key or contact PostHog support.`
          );
        }
      } else if (status === 403) {
        console.error(
          "❌ PostHog: Access forbidden (403)\n" +
            "   Your API key doesn't have permission to send events.\n" +
            "   Ensure you're using a project key, not a personal API key.\n" +
            `   Get your project key from: ${regionLabel === 'EU' ? 'https://eu.posthog.com' : 'https://app.posthog.com'}/project/settings`
        );
      } else if (status === 400) {
        console.error(
          "❌ PostHog: Bad request (400)\n" +
            "   The request format is invalid. This might indicate a configuration issue.\n" +
            `   Current host: ${meta.host}`
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
