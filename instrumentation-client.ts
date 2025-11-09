"use client";

import posthog from "posthog-js";

const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (typeof window !== "undefined" && apiKey && apiHost) {
  posthog.init(apiKey, {
    api_host: apiHost,
    defaults: "2025-05-24",
  });
}
