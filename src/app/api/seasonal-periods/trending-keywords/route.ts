import { getSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export interface TrendingKeyword {
  term: string;
  adjusted_demand_index: number | null;
  deseasoned_trend_momentum: number | null;
  engagement_score: number | null;
  competition_score: number | null;
  seasonal_label: string | null;
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
    const seasonalPeriodName = searchParams.get("periodName");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    if (!seasonalPeriodName) {
      return NextResponse.json(
        { error: "periodName is required" },
        { status: 400 }
      );
    }

    // Fetch keywords that have this seasonal period as their current seasonal_label
    // and order by adjusted_demand_index to get the most trending ones
    const { data, error } = await supabase
      .from("keywords")
      .select(
        "term, adjusted_demand_index, deseasoned_trend_momentum, engagement_score, competition_score, seasonal_label"
      )
      .eq("seasonal_label", seasonalPeriodName)
      .not("adjusted_demand_index", "is", null)
      .order("adjusted_demand_index", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching trending keywords:", error);
      return NextResponse.json(
        { error: "Failed to fetch trending keywords" },
        { status: 500 }
      );
    }

    return NextResponse.json(data as TrendingKeyword[]);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
