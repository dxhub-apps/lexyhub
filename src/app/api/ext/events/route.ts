// src/app/api/ext/events/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface ExtensionEventPayload {
  event_type: string;
  user_id?: string; // Optional, will be overridden with authenticated user
  marketplace?: string;
  keyword_id?: string;
  url?: string;
  timestamp?: string;
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Extension Events endpoint for Chrome Extension v4
 *
 * Accepts structured events for deterministic aggregation
 * Used to enrich ai_corpus and provide behavioral insights
 *
 * Privacy-first: No PII, no raw HTML, public marketplace data only
 *
 * Supported event types:
 * - keyword_search_event: User searched for a keyword on marketplace
 * - listing_view_event: User viewed a listing page
 * - shop_profile_event: User viewed a shop/store page
 * - lexy_action_event: User performed an extension action (analyze, add_to_watchlist, etc)
 *
 * Usage:
 * POST /api/ext/events
 * {
 *   "event_type": "keyword_search_event",
 *   "marketplace": "etsy",
 *   "keyword_id": "uuid",
 *   "url": "https://www.etsy.com/search?q=handmade+jewelry",
 *   "timestamp": "2025-11-10T12:00:00Z",
 *   "source": "extension",
 *   "metadata": {
 *     "search_position": 1,
 *     "page_number": 1
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true
 * }
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

  // Rate limit: 200 requests per minute (generous for event tracking)
  if (!checkRateLimit(context.userId, 200, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: ExtensionEventPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { event_type, marketplace, keyword_id, url, timestamp, source, metadata } = payload;

  // Validate event_type
  if (!event_type || !event_type.trim()) {
    return NextResponse.json(
      { error: "event_type is required" },
      { status: 400 }
    );
  }

  const validEventTypes = [
    "keyword_search_event",
    "listing_view_event",
    "shop_profile_event",
    "lexy_action_event",
  ];

  if (!validEventTypes.includes(event_type)) {
    return NextResponse.json(
      {
        error: `event_type must be one of: ${validEventTypes.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate marketplace (optional but recommended)
  if (marketplace) {
    const validMarkets = [
      "etsy",
      "amazon",
      "ebay",
      "walmart",
      "shopify",
      "google",
      "pinterest",
      "reddit",
      "bing",
    ];

    const normalizedMarket = marketplace.toLowerCase().trim();
    if (!validMarkets.includes(normalizedMarket)) {
      return NextResponse.json(
        {
          error: `marketplace must be one of: ${validMarkets.join(", ")}`,
        },
        { status: 400 }
      );
    }
  }

  // Validate URL (basic check for privacy - no PII)
  if (url) {
    // Block data URLs, localhost, and obvious PII patterns
    const urlLower = url.toLowerCase();
    if (
      urlLower.startsWith("data:") ||
      urlLower.includes("localhost") ||
      urlLower.includes("127.0.0.1") ||
      urlLower.includes("password") ||
      urlLower.includes("token") ||
      urlLower.includes("secret")
    ) {
      return NextResponse.json(
        { error: "Invalid or unsafe URL" },
        { status: 400 }
      );
    }

    // Limit URL length
    if (url.length > 2000) {
      return NextResponse.json(
        { error: "URL too long (max 2000 chars)" },
        { status: 400 }
      );
    }
  }

  // Validate metadata (must be object, limit size)
  if (metadata) {
    if (typeof metadata !== "object" || Array.isArray(metadata)) {
      return NextResponse.json(
        { error: "metadata must be an object" },
        { status: 400 }
      );
    }

    const metadataStr = JSON.stringify(metadata);
    if (metadataStr.length > 10000) {
      return NextResponse.json(
        { error: "metadata too large (max 10KB)" },
        { status: 400 }
      );
    }
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
    // Parse timestamp (use provided or current)
    let occurredAt: Date;
    if (timestamp) {
      try {
        occurredAt = new Date(timestamp);
        // Validate it's a reasonable timestamp (not too far in past/future)
        const now = Date.now();
        const diff = Math.abs(now - occurredAt.getTime());
        const oneDay = 24 * 60 * 60 * 1000;
        if (diff > oneDay) {
          // Too far off, use current time
          occurredAt = new Date();
        }
      } catch {
        occurredAt = new Date();
      }
    } else {
      occurredAt = new Date();
    }

    // Insert event
    const { error: insertError } = await supabase
      .from("extension_events")
      .insert({
        user_id: context.userId, // Always use authenticated user ID
        event_type,
        marketplace: marketplace ? marketplace.toLowerCase().trim() : null,
        keyword_id: keyword_id || null,
        url: url || null,
        source: source || "extension",
        occurred_at: occurredAt.toISOString(),
        metadata: metadata || {},
      });

    if (insertError) {
      console.error("Error inserting extension event:", insertError);

      // Check for specific errors
      if (insertError.code === "23503") {
        // Foreign key violation (invalid keyword_id)
        return NextResponse.json(
          { error: "Invalid keyword_id" },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "Failed to record event" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/events:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
