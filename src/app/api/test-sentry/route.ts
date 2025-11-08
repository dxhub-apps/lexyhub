/**
 * Test Sentry Integration Endpoint
 *
 * This endpoint tests the Sentry integration by sending different types of events.
 * Use this to verify that Sentry is properly configured and receiving events.
 *
 * Usage:
 *   GET  /api/test-sentry          - Send a test message
 *   GET  /api/test-sentry?error=1  - Trigger a test error
 *   GET  /api/test-sentry?fatal=1  - Trigger a fatal error
 *   GET  /api/test-sentry?all=1    - Send all test events
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isSentryConfigured } from "@/lib/monitoring/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const errorTest = searchParams.get("error") === "1";
  const fatalTest = searchParams.get("fatal") === "1";
  const allTests = searchParams.get("all") === "1";

  // Check if Sentry is configured
  if (!isSentryConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Sentry is not configured",
        error: "NEXT_PUBLIC_SENTRY_DSN is not set",
        instructions: [
          "1. Create .env.local file in project root",
          "2. Add: NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/your-project-id",
          "3. Get your DSN from: https://sentry.io/settings/projects/",
          "4. Restart the development server",
        ],
      },
      { status: 503 }
    );
  }

  const results: Array<{ type: string; status: string; eventId?: string }> = [];

  try {
    // Test 1: Send a test message
    if (!errorTest && !fatalTest) {
      const eventId = Sentry.captureMessage(
        "Test message from /api/test-sentry",
        {
          level: "info",
          tags: {
            test: "true",
            endpoint: "/api/test-sentry",
          },
          extra: {
            timestamp: new Date().toISOString(),
            userAgent: request.headers.get("user-agent"),
          },
        }
      );
      results.push({
        type: "message",
        status: "sent",
        eventId,
      });
    }

    // Test 2: Capture an error
    if (errorTest || allTests) {
      const testError = new Error("Test error from /api/test-sentry");
      testError.name = "TestError";

      const eventId = Sentry.captureException(testError, {
        level: "error",
        tags: {
          test: "true",
          errorType: "manual",
        },
        extra: {
          timestamp: new Date().toISOString(),
          testType: "error",
        },
      });
      results.push({
        type: "error",
        status: "sent",
        eventId,
      });
    }

    // Test 3: Capture a fatal error
    if (fatalTest || allTests) {
      const fatalError = new Error("Test fatal error from /api/test-sentry");
      fatalError.name = "TestFatalError";

      const eventId = Sentry.captureException(fatalError, {
        level: "fatal",
        tags: {
          test: "true",
          errorType: "fatal",
        },
        extra: {
          timestamp: new Date().toISOString(),
          testType: "fatal",
        },
      });
      results.push({
        type: "fatal",
        status: "sent",
        eventId,
      });
    }

    // Flush events to ensure they're sent immediately
    await Sentry.flush(2000);

    return NextResponse.json({
      success: true,
      message: "Sentry test events sent successfully",
      results,
      instructions: [
        "1. Check your Sentry dashboard at: https://sentry.io/",
        "2. Navigate to Issues to see the captured events",
        "3. Events should appear within a few seconds",
        "4. Look for events tagged with 'test: true'",
      ],
      sentryStatus: {
        configured: true,
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN?.substring(0, 40) + "...",
        environment: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    console.error("Error sending Sentry test events:", error);

    // Also try to capture this error in Sentry
    const eventId = Sentry.captureException(error, {
      level: "error",
      tags: {
        test: "true",
        errorType: "test-endpoint-failure",
      },
    });

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send Sentry test events",
        error: error instanceof Error ? error.message : "Unknown error",
        eventId,
        results,
      },
      { status: 500 }
    );
  }
}
