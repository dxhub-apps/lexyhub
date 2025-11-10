// src/app/api/ext/watchlist/add/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPlanConfig } from "@/lib/billing/plans";

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
    // 1. Check watchlist quota (WL) before inserting
    // Get user's plan
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", context.userId)
      .maybeSingle();

    const planCode = (profileData?.plan || "free") as "free" | "free_extension" | "basic" | "pro" | "growth";
    const planConfig = getPlanConfig(planCode);
    const watchlistLimit = planConfig.niches_max;

    // Count existing watchlist items
    const { count: currentCount } = await supabase
      .from("user_watchlist_terms")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId);

    // Check if adding this term would exceed the limit
    if (watchlistLimit !== -1 && (currentCount ?? 0) >= watchlistLimit) {
      return NextResponse.json(
        {
          error: "Watchlist limit reached",
          code: "watchlist_limit_reached",
          quota_key: "wl",
          used: currentCount,
          limit: watchlistLimit,
          message: `You've reached your watchlist limit (${watchlistLimit} keywords). Upgrade your plan for more watchlist capacity.`,
        },
        { status: 402 }
      );
    }

    // 2. Insert into user_watchlist_terms
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

    // 3. Track community signal (if user has opted in)
    const { data: settings } = await supabase
      .from("user_extension_settings")
      .select("community_signal_opt_in")
      .eq("user_id", context.userId)
      .single();

    if (settings?.community_signal_opt_in) {
      // Call the increment function
      const { error: signalError } = await supabase.rpc(
        "increment_community_signal",
        {
          p_term: term.trim(),
          p_market: market.toLowerCase(),
        }
      );

      if (signalError) {
        console.error("Error incrementing community signal:", signalError);
        // Don't fail the request
      }
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
