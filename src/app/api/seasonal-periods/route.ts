import { getSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export interface SeasonalPeriod {
  id: string;
  name: string;
  country_code: string | null;
  start_date: string;
  end_date: string;
  weight: number;
  tags: string[];
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const countryCode = searchParams.get("countryCode");

    // Build base query - fetch all seasonal periods
    let query = supabase
      .from("seasonal_periods")
      .select("*")
      .order("start_date", { ascending: true });

    // Filter by country code if provided
    if (countryCode) {
      query = query.or(`country_code.eq.${countryCode},country_code.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching seasonal periods:", error);
      return NextResponse.json(
        { error: "Failed to fetch seasonal periods", details: error.message },
        { status: 500 }
      );
    }

    // Log for debugging
    console.log(`Fetched ${data?.length || 0} seasonal periods from database`);

    return NextResponse.json(data as SeasonalPeriod[]);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
