/**
 * PostHog Configuration Diagnostic Endpoint
 *
 * This endpoint helps diagnose PostHog 401 authentication errors by:
 * - Showing the current environment variables (masked)
 * - Testing the PostHog API key validity
 * - Providing actionable troubleshooting steps
 *
 * Access: /api/debug/posthog
 */

import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

  // Basic configuration check
  const config = {
    hasKey: !!apiKey,
    keyFormat: apiKey ? (apiKey.startsWith("phc_") ? "✅ Valid (phc_)" : "❌ Invalid format") : "❌ Not set",
    keyPreview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : "NOT SET",
    host: apiHost,
    isEuHost: apiHost.includes("eu.") && apiHost.includes("posthog.com"),
    isUsHost: (apiHost.includes("app.posthog.com") || apiHost.includes("us.")) && apiHost.includes("posthog.com"),
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || "not-vercel",
  };

  // Test the API key by making a test request to PostHog
  let apiTest = {
    tested: false,
    valid: false,
    error: null as string | null,
    statusCode: null as number | null,
  };

  if (apiKey && apiKey.startsWith("phc_")) {
    try {
      // Test the API key with a minimal event
      const testResponse = await fetch(`${apiHost}/batch/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          batch: [
            {
              event: "$test_event",
              properties: {
                distinct_id: "diagnostic-test",
                $lib: "posthog-diagnostic",
              },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      apiTest = {
        tested: true,
        valid: testResponse.ok,
        error: testResponse.ok ? null : `HTTP ${testResponse.status}: ${testResponse.statusText}`,
        statusCode: testResponse.status,
      };
    } catch (error) {
      apiTest = {
        tested: true,
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        statusCode: null,
      };
    }
  }

  // Generate diagnostic report
  const diagnostics = {
    config,
    apiTest,
    troubleshooting: generateTroubleshooting(config, apiTest),
  };

  return NextResponse.json(diagnostics, { status: 200 });
}

function generateTroubleshooting(config: any, apiTest: any): string[] {
  const steps: string[] = [];

  if (!config.hasKey) {
    steps.push("❌ NEXT_PUBLIC_POSTHOG_KEY is not set in environment variables");
    steps.push("→ Add NEXT_PUBLIC_POSTHOG_KEY to your Vercel environment variables");
    return steps;
  }

  if (config.keyFormat.includes("Invalid")) {
    steps.push("❌ API key format is invalid - should start with 'phc_'");
    steps.push("→ Verify you copied the PROJECT API KEY, not a personal API key");
    return steps;
  }

  if (apiTest.tested && !apiTest.valid) {
    if (apiTest.statusCode === 401) {
      steps.push("❌ 401 Unauthorized - PostHog rejected the API key");
      steps.push("");
      steps.push("Most common causes:");
      steps.push("1. KEY FROM WRONG INSTANCE");
      steps.push(`   Current host: ${config.host} (${config.isEuHost ? "EU" : "US"} instance)`);
      steps.push(`   → Verify your key is from: ${config.isEuHost ? "https://eu.posthog.com" : "https://app.posthog.com"}`);
      steps.push("   → Check: Project Settings → Project API Key");
      steps.push("");
      steps.push("2. STALE VERCEL BUILD");
      steps.push("   → Redeploy in Vercel to pick up new environment variables");
      steps.push("   → Clear build cache: Settings → Clear Build Cache");
      steps.push("");
      steps.push("3. INVALID/REVOKED KEY");
      steps.push("   → The key may have been revoked or project deleted");
      steps.push("   → Try creating a NEW project API key in PostHog");
    } else if (apiTest.statusCode === 403) {
      steps.push("❌ 403 Forbidden - Key exists but lacks permissions");
      steps.push("→ Ensure you're using a PROJECT key, not a personal API key");
    } else {
      steps.push(`❌ API test failed with status ${apiTest.statusCode}`);
      steps.push(`→ Error: ${apiTest.error}`);
    }
  } else if (apiTest.tested && apiTest.valid) {
    steps.push("✅ API key is VALID and working!");
    steps.push("");
    steps.push("If you're still seeing 401 errors in the browser:");
    steps.push("1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)");
    steps.push("2. Clear browser cache and cookies");
    steps.push("3. Check browser console for the actual key being used (might be different)");
    steps.push("4. Verify Vercel deployment picked up the latest environment variables");
  }

  return steps;
}
