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

    // Convert to key-value object. Values are stored as JSON in Supabase,
    // but may be returned as strings depending on the column type. Attempt
    // to parse stringified JSON so the extension receives the correct data
    // structure without additional transforms.
    const config: Record<string, any> = {};
    (data || []).forEach((row) => {
      const rawValue = row.value;
      let parsedValue = rawValue;

      if (typeof rawValue === "string") {
        try {
          parsedValue = JSON.parse(rawValue);
        } catch (_) {
          parsedValue = rawValue;
        }
      }

      config[row.key] = parsedValue;
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Unexpected error in /api/ext/remote-config:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Prevent static generation attempts
export const revalidate = 0; // Always fetch fresh data
