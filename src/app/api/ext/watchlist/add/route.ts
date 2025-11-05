// src/app/api/ext/watchlist/add/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface AddToWatchlistPayload {
  term: string;
  market: string;
  source_url?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit
  if (!checkRateLimit(context.userId, 100, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: AddToWatchlistPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { term, market, source_url } = payload;

  // Validate
  if (!term || !term.trim()) {
    return NextResponse.json(
      { error: "term is required" },
      { status: 400 }
    );
  }

  if (!market || !market.trim()) {
    return NextResponse.json(
      { error: "market is required" },
      { status: 400 }
    );
  }

  const validMarkets = ["etsy", "amazon", "shopify", "google", "pinterest", "reddit"];
  if (!validMarkets.includes(market.toLowerCase())) {
    return NextResponse.json(
      { error: `market must be one of: ${validMarkets.join(", ")}` },
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
    // 1. Insert into user_watchlist_terms
    const { data: watchlistItem, error: watchlistError } = await supabase
      .from("user_watchlist_terms")
      .insert({
        user_id: context.userId,
        term: term.trim(),
        market: market.toLowerCase(),
        source_url,
      })
      .select("id")
      .single();

    if (watchlistError) {
      // Check if it's a duplicate (unique constraint violation)
      if (watchlistError.code === "23505") {
        // Already in watchlist, return success
        return NextResponse.json({
          ok: true,
          watchlist_id: null,
          message: "Term already in watchlist",
        });
      }

      console.error("Error inserting into user_watchlist_terms:", watchlistError);
      return NextResponse.json(
        { error: "Failed to add to watchlist" },
        { status: 500 }
      );
    }

    // 2. Enqueue for golden source upsert
    const { error: queueError } = await supabase
      .from("ext_watchlist_upsert_queue")
      .insert({
        user_id: context.userId,
        market: market.toLowerCase(),
        term: term.trim(),
        source_url,
      });

    if (queueError) {
      console.error("Error enqueueing for upsert:", queueError);
      // Don't fail the request if queueing fails
    }

    return NextResponse.json({
      ok: true,
      watchlist_id: watchlistItem.id,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/watchlist/add:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
