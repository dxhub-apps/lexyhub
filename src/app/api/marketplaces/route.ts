/**
 * Marketplaces API
 *
 * Returns available marketplace providers from the database
 * Used for dynamic dropdowns across the application
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Fetch marketplace providers (excluding synthetic/manual providers)
    const { data: providers, error } = await supabase
      .from("data_providers")
      .select("id, display_name, provider_type, is_enabled")
      .eq("provider_type", "marketplace")
      .eq("is_enabled", true)
      .order("display_name", { ascending: true });

    if (error) {
      console.error("Error fetching marketplaces:", error);
      return NextResponse.json(
        { error: "Failed to fetch marketplaces" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      marketplaces: providers || [],
    });
  } catch (error) {
    console.error("Unexpected error fetching marketplaces:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
