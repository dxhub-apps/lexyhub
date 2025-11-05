// src/app/api/ext/session/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface SessionPayload {
  session_id: string;
  market: string;
  started_at: string;
  ended_at?: string;
  search_queries: string[];
  clicked_listings: Array<{
    title: string;
    url: string;
    position: number;
  }>;
  terms_discovered: string[];
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
  let payload: SessionPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // Insert session
    const { data, error } = await supabase
      .from("extension_sessions")
      .insert({
        user_id: context.userId,
        session_id: payload.session_id,
        market: payload.market,
        started_at: payload.started_at,
        ended_at: payload.ended_at || new Date().toISOString(),
        search_queries: payload.search_queries,
        clicked_listings: payload.clicked_listings,
        terms_discovered: payload.terms_discovered,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving session:", error);
      return NextResponse.json(
        { error: "Failed to save session" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, session: data });
  } catch (error) {
    console.error("Unexpected error in /api/ext/session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
