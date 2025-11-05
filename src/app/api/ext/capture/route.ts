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
 * Extension capture events table schema:
 * - id: bigserial
 * - user_id: uuid
 * - source: text (e.g., 'etsy_search', 'amazon_listing')
 * - url: text
 * - terms: jsonb
 * - serp_meta: jsonb
 * - captured_at: timestamptz
 * - hour_bucket: timestamptz (for deduplication)
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

    // TODO: Implement actual database table and deduplication logic
    // For MVP, just log the capture event
    console.log("Extension capture event:", {
      userId: context.userId,
      source,
      url: url.substring(0, 100), // Truncate for logging
      termsCount: terms.length,
      hourBucket,
    });

    // In production, you would:
    // 1. Check for duplicate capture within the same hour bucket
    // 2. Insert into extension_capture_events table
    // 3. Optionally aggregate for analytics

    // const { error } = await supabase.from("extension_capture_events").insert({
    //   user_id: context.userId,
    //   source,
    //   url,
    //   terms,
    //   serp_meta: serp_meta || {},
    //   captured_at: now.toISOString(),
    //   hour_bucket: hourBucket,
    // });

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
