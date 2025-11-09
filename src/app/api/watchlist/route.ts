// src/app/api/watchlist/route.ts
// API endpoints for managing user keyword watchlists

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

// GET /api/watchlist - Get user's watchlist
export async function GET(req: Request): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: watchlist, error } = await supabase
      .from("user_keyword_watchlists")
      .select(
        `
        id,
        keyword_id,
        alert_threshold,
        alert_enabled,
        notes,
        created_at,
        updated_at,
        keywords (
          id,
          term,
          market,
          source,
          trend_momentum,
          adjusted_demand_index,
          competition_score,
          extras
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch watchlist:", error);
      return NextResponse.json({ error: "Failed to fetch watchlist" }, { status: 500 });
    }

    return NextResponse.json({ watchlist });
  } catch (error) {
    console.error("Error in GET /api/watchlist:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/watchlist - Add keyword to watchlist
export async function POST(req: Request): Promise<NextResponse> {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }


    const body = await req.json();
    const { keyword_id, alert_threshold, alert_enabled, notes } = body;

    if (!keyword_id) {
      return NextResponse.json({ error: "keyword_id is required" }, { status: 400 });
    }

    // Check if keyword exists
    const { data: keyword, error: keywordError } = await supabase
      .from("keywords")
      .select("id")
      .eq("id", keyword_id)
      .single();

    if (keywordError || !keyword) {
      return NextResponse.json({ error: "Keyword not found" }, { status: 404 });
    }

    // Add to watchlist
    const { data: watchlistItem, error: insertError } = await supabase
      .from("user_keyword_watchlists")
      .insert({
        user_id: user.id,
        keyword_id,
        alert_threshold: alert_threshold ?? 15.0,
        alert_enabled: alert_enabled ?? true,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (insertError) {
      // Check for duplicate
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "Keyword already in watchlist" }, { status: 409 });
      }

      console.error("Failed to add to watchlist:", insertError);
      return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
    }

    return NextResponse.json({ watchlistItem }, { status: 201 });
  } catch (error) {
    console.error("Error in POST /api/watchlist:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
