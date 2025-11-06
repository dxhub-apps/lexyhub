import posthog from "posthog-js";

export function initPostHog() {
  if (typeof window !== "undefined") {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

    if (apiKey) {
      posthog.init(apiKey, {
        api_host: apiHost,

        // Enable debug mode in development
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
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
    }
  }

  return posthog;
}

export { posthog };
