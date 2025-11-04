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
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const countryCode = searchParams.get("countryCode");

    let query = supabase
      .from("seasonal_periods")
      .select("*")
      .order("start_date", { ascending: true });

    // Filter by date range if provided
    if (startDate && endDate) {
      query = query.or(
        `and(start_date.gte.${startDate},start_date.lte.${endDate}),and(end_date.gte.${startDate},end_date.lte.${endDate}),and(start_date.lte.${startDate},end_date.gte.${endDate})`
      );
    }

    // Filter by country code if provided
    if (countryCode) {
      query = query.or(`country_code.eq.${countryCode},country_code.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching seasonal periods:", error);
      return NextResponse.json(
        { error: "Failed to fetch seasonal periods" },
        { status: 500 }
      );
    }

    return NextResponse.json(data as SeasonalPeriod[]);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
