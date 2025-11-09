// src/app/api/ext/capture/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { log } from "@/lib/logger";

interface CapturePayload {
  source: string;
  url: string;
  terms: Array<{
    t: string;  // term
    w: number;  // weight/confidence
    pos: string; // position: 'title' | 'tag' | 'description' | 'other'
  }>;
  serp_meta?: {
    page?: number;
    results?: number;
  };
}

/**
 * Extension capture events are stored in keyword_events table with:
 * - event_type: 'ext_capture'
 * - payload containing: source, url, terms, serp_meta, hour_bucket
 * This allows tracking of keyword discovery from the browser extension
 */

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();

  try {
    // Authenticate
    const context = await authenticateExtension(request);
    if (!context) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Set user context in Sentry
    Sentry.setUser({ id: context.userId });
    Sentry.setContext("extension_capture", {
      requestId,
      userId: context.userId,
    });

    // Rate limit (higher limit for capture events)
    if (!checkRateLimit(context.userId, 500, 60000)) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    // Parse payload
    let payload: CapturePayload;
    try {
      payload = await request.json();
    } catch (error) {
      log.error("Failed to parse capture payload", { error, requestId, userId: context.userId });
      Sentry.captureException(error, {
        tags: {
          feature: "extension",
          component: "capture",
          errorType: "invalid-json",
          requestId,
        },
      });
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    const { source, url, terms, serp_meta } = payload;

    // Validate
    if (!source || !url || !Array.isArray(terms)) {
      return NextResponse.json(
        { error: "source, url, and terms are required" },
        { status: 400 }
      );
    }

    if (terms.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 terms per capture" },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      const error = new Error("Supabase client unavailable");
      log.error("Service unavailable", { error, requestId });
      Sentry.captureException(error, {
        tags: {
          feature: "extension",
          component: "capture",
          errorType: "service-unavailable",
          requestId,
        },
        level: "fatal",
      });
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    try {
      // Create hour bucket for deduplication
      const now = new Date();
      const hourBucket = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours()
      ).toISOString();

      // Store the capture event in keyword_events table
      // This allows tracking of keyword discovery from browser extension
      const { error } = await supabase.from("keyword_events").insert({
        user_id: context.userId,
        event_type: "ext_capture",
        occurred_at: now.toISOString(),
        payload: {
          source,
          url,
          terms,
          serp_meta: serp_meta || {},
          hour_bucket: hourBucket,
        },
      });

      if (error) {
        log.error("Failed to store extension capture event", {
          error,
          requestId,
          userId: context.userId,
          source,
          termsCount: terms.length,
        });

        Sentry.captureException(error, {
          tags: {
            feature: "extension",
            component: "capture",
            errorType: "db-insert-failed",
            requestId,
            source,
          },
          extra: {
            termsCount: terms.length,
            url,
          },
        });
        // Don't fail the request if storage fails
        // Extension should work even if analytics storage fails
      }

      return NextResponse.json({ ok: true, requestId });
    } catch (error) {
      log.error("Unexpected error in extension capture", {
        error,
        requestId,
        userId: context.userId,
      });

      Sentry.captureException(error, {
        tags: {
          feature: "extension",
          component: "capture",
          errorType: "unexpected",
          requestId,
        },
        level: "error",
      });

      return NextResponse.json(
        { error: "Internal server error", requestId },
        { status: 500 }
      );
    }
  } catch (error) {
    // Top-level error handler
    log.error("Top-level error in extension capture", { error, requestId });

    Sentry.captureException(error, {
      tags: {
        feature: "extension",
        component: "capture",
        errorType: "top-level",
        requestId,
      },
      level: "fatal",
    });

    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
