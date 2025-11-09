"use client";

import posthog from "posthog-js";

let hasInitialized = false;

function hasClientConfig() {
  return typeof window !== "undefined" && Boolean(posthog.config?.token);
}

export function initPostHog() {
  if (typeof window === "undefined") {
    return null;
  }

  if (hasClientConfig()) {
    hasInitialized = true;
    return posthog;
  }

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!apiKey || !apiHost) {
    return null;
  }

  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: "2025-05-24",
  });

  hasInitialized = true;
  return posthog;
}

export function getPostHog() {
  return hasClientConfig() ? posthog : null;
}

export function isPostHogReady(): boolean {
  if (hasClientConfig()) {
    hasInitialized = true;
  }

  return hasInitialized && typeof window !== "undefined";
}

export { posthog };
