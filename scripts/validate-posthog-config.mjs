#!/usr/bin/env node
import process from "node:process";

const shouldValidate =
  process.env.POSTHOG_VALIDATE === "true" ||
  process.env.CI === "true" ||
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true";

if (process.env.SKIP_POSTHOG_VALIDATION === "1") {
  console.log("⚠️ Skipping PostHog configuration validation because SKIP_POSTHOG_VALIDATION=1");
  process.exit(0);
}

if (!shouldValidate) {
  console.log("ℹ️ Skipping PostHog configuration validation (CI/VERCEL not detected).");
  console.log("   Set POSTHOG_VALIDATE=true to force validation locally.");
  process.exit(0);
}

const rawKey = (process.env.NEXT_PUBLIC_POSTHOG_KEY || process.env.POSTHOG_PROJECT_KEY || "").trim();
const rawHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST || process.env.POSTHOG_HOST || "").trim();

if (!rawKey) {
  console.error("❌ PostHog validation failed: NEXT_PUBLIC_POSTHOG_KEY is not set.");
  console.error("   Set NEXT_PUBLIC_POSTHOG_KEY (or POSTHOG_PROJECT_KEY) before building.");
  process.exit(1);
}

if (!rawHost) {
  console.error("❌ PostHog validation failed: NEXT_PUBLIC_POSTHOG_HOST is not set.");
  console.error("   Set NEXT_PUBLIC_POSTHOG_HOST (or POSTHOG_HOST) before building.");
  process.exit(1);
}

if (!rawKey.startsWith("phc_")) {
  console.error("❌ PostHog validation failed: Project key must start with 'phc_'.");
  console.error("   Key preview:", `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`);
  console.error("   Copy the Project API key from PostHog → Project Settings.");
  process.exit(1);
}

const apiHost = rawHost.replace(/\/+$/, "");

if (!/^https?:\/\//.test(apiHost)) {
  console.error("❌ PostHog validation failed: NEXT_PUBLIC_POSTHOG_HOST must be a full URL (https://...).");
  console.error("   Current value:", rawHost);
  process.exit(1);
}

const endpoint = `${apiHost}/i/v0/e/`;
const previewKey = `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`;

const payload = {
  api_key: rawKey,
  event: "$posthog_config_validation",
  distinct_id: `posthog-config-check-${Date.now()}`,
  properties: {
    $lib: "posthog-config-validator",
    validation_source: "build",
    host_checked: apiHost,
  },
  timestamp: new Date().toISOString(),
};

console.log(`🔍 Validating PostHog configuration against ${endpoint}`);

try {
  const controller = typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? { signal: AbortSignal.timeout(10000) }
    : {};

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    ...controller,
  });

  if (!response.ok) {
    let details = "";
    try {
      details = await response.text();
    } catch (error) {
      details = `Unable to read response body: ${error instanceof Error ? error.message : String(error)}`;
    }

    console.error("❌ PostHog validation failed: HTTP", response.status, response.statusText);
    console.error("   Host attempted:", apiHost);
    console.error("   Key preview:", previewKey);
    if (details) {
      console.error("   Response:", details.slice(0, 2000));
    }
    console.error("");
    console.error("Troubleshooting steps:");
    console.error("  • Ensure the API key belongs to the", apiHost.includes("eu") ? "EU" : "US", "PostHog instance.");
    console.error("  • Generate a new Project API key in PostHog and update NEXT_PUBLIC_POSTHOG_KEY.");
    console.error("  • Redeploy with a cleared build cache if you're using Vercel.");
    console.error("  • Use /api/debug/posthog in the deployed app for detailed diagnostics.");
    process.exit(1);
  }

  console.log(`✅ PostHog key ${previewKey} is valid for host ${apiHost}`);
  process.exit(0);
} catch (error) {
  console.error("❌ PostHog validation encountered an unexpected error:");
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  console.error("");
  console.error("Troubleshooting steps:");
  console.error("  • Verify the PostHog host is reachable from the build environment.");
  console.error("  • Check for firewalls or network rules blocking ${apiHost}.");
  console.error("  • Re-run with POSTHOG_VALIDATE=true locally to reproduce.");
  process.exit(1);
}
