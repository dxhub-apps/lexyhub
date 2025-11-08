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
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  // Basic configuration check
  const config = {
    hasKey: !!apiKey,
    hasHost: !!apiHost,
    keyFormat: apiKey ? (apiKey.startsWith("phc_") ? "✅ Valid (phc_)" : "❌ Invalid format") : "❌ Not set",
    keyPreview: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : "NOT SET",
    host: apiHost || "❌ NOT SET",
    isEuHost: apiHost ? (apiHost.includes("eu.") && apiHost.includes("posthog.com")) : false,
    isUsHost: apiHost ? ((apiHost.includes("app.posthog.com") || apiHost.includes("us.")) && apiHost.includes("posthog.com")) : false,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || "not-vercel",
  };

  // Test the API key by making test requests to PostHog
  // Test BOTH endpoints since the browser uses a different one than server
  let apiTestBatch = {
    endpoint: "/batch/",
    tested: false,
    valid: false,
    error: null as string | null,
    statusCode: null as number | null,
  };

  let apiTestCapture = {
    endpoint: "/i/v0/e/",
    tested: false,
    valid: false,
    error: null as string | null,
    statusCode: null as number | null,
  };

  if (apiKey && apiKey.startsWith("phc_")) {
    // Test 1: Batch endpoint (server-side)
    try {
      const testResponse = await fetch(`${apiHost}/batch/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          batch: [
            {
              event: "$test_event_batch",
              properties: {
                distinct_id: "diagnostic-test-batch",
                $lib: "posthog-diagnostic",
              },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      apiTestBatch = {
        endpoint: "/batch/",
        tested: true,
        valid: testResponse.ok,
        error: testResponse.ok ? null : `HTTP ${testResponse.status}: ${testResponse.statusText}`,
        statusCode: testResponse.status,
      };
    } catch (error) {
      apiTestBatch = {
        endpoint: "/batch/",
        tested: true,
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
        statusCode: null,
      };
    }

    // Test 2: Capture endpoint (client-side, what the browser uses)
    // This is the EXACT endpoint path the browser PostHog.js uses
    try {
      const payload = {
        api_key: apiKey,
        event: "$test_event_capture",
        distinct_id: "diagnostic-test-capture",
        properties: {
          $lib: "posthog-diagnostic",
          test_source: "api_diagnostic",
        },
        timestamp: new Date().toISOString(),
      };

      // Use the full path that posthog-js client library uses
      const testResponse = await fetch(`${apiHost}/i/v0/e/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      let errorDetails = null;
      if (!testResponse.ok) {
        try {
          const responseText = await testResponse.text();
          errorDetails = `HTTP ${testResponse.status}: ${testResponse.statusText} - ${responseText}`;
        } catch {
          errorDetails = `HTTP ${testResponse.status}: ${testResponse.statusText}`;
        }
      }

      apiTestCapture = {
        endpoint: "/i/v0/e/",
        tested: true,
        valid: testResponse.ok,
        error: errorDetails,
        statusCode: testResponse.status,
      };
    } catch (error) {
      apiTestCapture = {
        endpoint: "/i/v0/e/",
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
    apiTests: {
      batch: apiTestBatch,
      capture: apiTestCapture,
    },
    troubleshooting: generateTroubleshooting(config, apiTestBatch, apiTestCapture),
  };

  return NextResponse.json(diagnostics, { status: 200 });
}

function generateTroubleshooting(config: any, batchTest: any, captureTest: any): string[] {
  const steps: string[] = [];

  if (!config.hasKey) {
    steps.push("❌ NEXT_PUBLIC_POSTHOG_KEY is not set in environment variables");
    steps.push("→ Add NEXT_PUBLIC_POSTHOG_KEY to your Vercel environment variables");
    return steps;
  }

  if (!config.hasHost) {
    steps.push("❌ NEXT_PUBLIC_POSTHOG_HOST is not set in environment variables");
    steps.push("→ Add NEXT_PUBLIC_POSTHOG_HOST to your Vercel environment variables");
    steps.push("   For EU instance: NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com");
    steps.push("   For US instance: NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com");
    return steps;
  }

  if (config.keyFormat.includes("Invalid")) {
    steps.push("❌ API key format is invalid - should start with 'phc_'");
    steps.push("→ Verify you copied the PROJECT API KEY, not a personal API key");
    return steps;
  }

  // Check the results of both tests
  const batchWorks = batchTest.tested && batchTest.valid;
  const captureWorks = captureTest.tested && captureTest.valid;

  if (batchWorks && captureWorks) {
    steps.push("✅ BOTH API endpoints work correctly!");
    steps.push(`   ${batchTest.endpoint} → ${batchTest.statusCode}`);
    steps.push(`   ${captureTest.endpoint} → ${captureTest.statusCode}`);
    steps.push("");
    steps.push("If you're STILL seeing 401 errors in the browser:");
    steps.push("1. Check browser Network tab - compare the API key being sent");
    steps.push("2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)");
    steps.push("3. Clear browser cache completely");
    steps.push("4. Check if PostHog is blocked by an ad blocker or privacy extension");
    steps.push("5. Try in incognito mode to rule out browser extensions");
  } else if (batchWorks && !captureWorks) {
    steps.push("🔍 FOUND THE ISSUE!");
    steps.push("");
    steps.push(`✅ Batch endpoint (${batchTest.endpoint}) works - Status: ${batchTest.statusCode}`);
    steps.push(`❌ Capture endpoint (${captureTest.endpoint}) FAILS - Status: ${captureTest.statusCode}`);
    steps.push("");
    steps.push("This is the EXACT endpoint your browser uses!");
    steps.push("");
    if (captureTest.statusCode === 401) {
      steps.push("The /e/ endpoint rejects your API key (401 Unauthorized).");
      steps.push("");
      steps.push("Possible causes:");
      steps.push("1. API KEY FROM WRONG POSTHOG INSTANCE");
      steps.push(`   You're using: ${config.host}`);
      steps.push(`   Your key might be from: ${config.isEuHost ? 'US instance (app.posthog.com)' : 'EU instance (eu.posthog.com)'}`);
      steps.push(`   → Log into: ${config.isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}`);
      steps.push("   → Verify this is YOUR project");
      steps.push("   → If not, switch to the other instance");
      steps.push("");
      steps.push("2. CORRUPTED OR INVALID API KEY");
      steps.push("   → Generate a BRAND NEW project API key in PostHog");
      steps.push("   → Update NEXT_PUBLIC_POSTHOG_KEY in Vercel");
      steps.push("   → Redeploy");
      steps.push("");
      steps.push("3. POSTHOG PROJECT ISSUE");
      steps.push("   → Your project may have restrictions");
      steps.push("   → Contact PostHog support: hey@posthog.com");
    } else if (captureTest.statusCode === 400) {
      steps.push("The /e/ endpoint returned 400 Bad Request.");
      steps.push("This usually means the request format is wrong, not the API key.");
      steps.push("→ This might be a bug in the diagnostic test itself.");
    }
  } else if (!batchWorks && captureWorks) {
    steps.push("⚠️ UNUSUAL: Capture works but batch doesn't");
    steps.push(`   ${batchTest.endpoint} → ${batchTest.statusCode} (FAILED)`);
    steps.push(`   ${captureTest.endpoint} → ${captureTest.statusCode} (OK)`);
    steps.push("");
    steps.push("This is unexpected. The browser should work fine.");
    steps.push("If you're seeing errors, they might be from something else.");
  } else {
    // Both failed
    steps.push("❌ BOTH API endpoints are failing!");
    steps.push(`   ${batchTest.endpoint} → ${batchTest.statusCode || 'Error'}`);
    steps.push(`   ${captureTest.endpoint} → ${captureTest.statusCode || 'Error'}`);
    steps.push("");
    steps.push("This indicates a fundamental issue:");
    steps.push("1. API key is completely invalid or from wrong instance");
    steps.push("2. PostHog host URL is incorrect");
    steps.push("3. Network/firewall blocking PostHog");
    steps.push("");
    steps.push("Steps to fix:");
    steps.push(`1. Log into PostHog: ${config.isEuHost ? 'https://eu.posthog.com' : 'https://app.posthog.com'}`);
    steps.push("2. Go to: Project Settings → Project API Key");
    steps.push("3. Copy the EXACT key (don't modify it)");
    steps.push("4. In Vercel: Update NEXT_PUBLIC_POSTHOG_KEY");
    steps.push("5. Verify NEXT_PUBLIC_POSTHOG_HOST matches your PostHog instance");
    steps.push("6. Redeploy with cleared cache");
  }

  return steps;
}
