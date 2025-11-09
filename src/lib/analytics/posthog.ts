"use client";

import posthog from "posthog-js";

let hasInitialized = false;

const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passcode",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "apitoken",
  "authorization",
  "bearer",
  "session",
  "cookie",
  "credential",
  "clientsecret",
  "privatetoken",
  "privatekey",
];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string) {
  const normalizedKey = normalizeKey(key);

  return SENSITIVE_KEY_PATTERNS.some((pattern) =>
    normalizedKey.includes(pattern)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeAnalyticsProperties<T>(value: T): T {
  if (!value) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAnalyticsProperties(item)) as unknown as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeAnalyticsProperties(nestedValue);
  }

  return sanitized as T;
}

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
    sanitize_properties(properties) {
      return sanitizeAnalyticsProperties(properties);
    },
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
