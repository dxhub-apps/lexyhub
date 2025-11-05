// src/app/api/ext/watchlist/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import crypto from "crypto";

export async function GET(request: Request): Promise<NextResponse> {
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit
  if (!checkRateLimit(context.userId, 200, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const market = url.searchParams.get("market");
  const since = url.searchParams.get("since");

  // Get Supabase client
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    let query = supabase
      .from("user_watchlist_terms")
      .select("term, market, created_at")
      .eq("user_id", context.userId);

    if (market) {
      query = query.eq("market", market.toLowerCase());
    }

    if (since) {
      query = query.gte("created_at", since);
    }

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching watchlist terms:", error);
      return NextResponse.json(
        { error: "Failed to fetch watchlist" },
        { status: 500 }
      );
    }

    // Extract just the terms
    const terms = (data || []).map((item) => item.term);

    // Generate a version hash for caching
    const version = crypto
      .createHash("md5")
      .update(JSON.stringify(terms))
      .digest("hex")
      .substring(0, 16);

    return NextResponse.json({
      terms,
      version,
      count: terms.length,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/watchlist:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
