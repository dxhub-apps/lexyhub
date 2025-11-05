// src/app/api/ext/capture/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

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
  } catch {
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
      console.error("Failed to store extension capture event:", error);
      // Don't fail the request if storage fails
      // Extension should work even if analytics storage fails
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error in /api/ext/capture:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
