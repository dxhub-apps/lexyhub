// src/app/api/watchlist/[id]/route.ts
// API endpoints for managing individual watchlist items

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

// Helper to get authenticated user
async function getAuthenticatedUser(supabase: ReturnType<typeof getSupabaseServerClient>) {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

// PATCH /api/watchlist/[id] - Update watchlist item
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { alert_threshold, alert_enabled, notes } = body;

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (alert_threshold !== undefined) {
      updates.alert_threshold = alert_threshold;
    }

    if (alert_enabled !== undefined) {
      updates.alert_enabled = alert_enabled;
    }

    if (notes !== undefined) {
      updates.notes = notes;
    }

    const { data: watchlistItem, error } = await supabase
      .from("user_keyword_watchlists")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", user.id) // Ensure user owns this watchlist item
      .select()
      .single();

    if (error || !watchlistItem) {
      if (error?.code === "PGRST116") {
        return NextResponse.json({ error: "Watchlist item not found" }, { status: 404 });
      }

      console.error("Failed to update watchlist item:", error);
      return NextResponse.json({ error: "Failed to update watchlist item" }, { status: 500 });
    }

    return NextResponse.json({ watchlistItem });
  } catch (error) {
    console.error("Error in PATCH /api/watchlist/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/watchlist/[id] - Remove from watchlist
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const user = await getAuthenticatedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("user_keyword_watchlists")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id); // Ensure user owns this watchlist item

    if (error) {
      console.error("Failed to delete watchlist item:", error);
      return NextResponse.json({ error: "Failed to delete watchlist item" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/watchlist/[id]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
