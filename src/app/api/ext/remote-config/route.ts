// src/app/api/ext/remote-config/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: Request): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // Fetch all remote config values
    const { data, error } = await supabase
      .from("extension_remote_config")
      .select("key, value");

    if (error) {
      console.error("Error fetching remote config:", error);
      return NextResponse.json(
        { error: "Failed to fetch config" },
        { status: 500 }
      );
    }

    // Convert to key-value object
    const config: Record<string, any> = {};
    (data || []).forEach((row) => {
      config[row.key] = row.value;
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Unexpected error in /api/ext/remote-config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const revalidate = 60; // Cache for 1 minute
