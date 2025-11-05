import { getSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

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

    // Make events recurring annually by adjusting dates to current/next year
    const currentYear = new Date().getFullYear();
    const adjustedData = data?.map((period) => {
      const startDate = new Date(period.start_date);
      const endDate = new Date(period.end_date);

      // Get the month and day from the original dates
      const startMonth = startDate.getMonth();
      const startDay = startDate.getDate();
      const endMonth = endDate.getMonth();
      const endDay = endDate.getDate();

      // Create new dates with current year
      let newStartDate = new Date(currentYear, startMonth, startDay);
      let newEndDate = new Date(currentYear, endMonth, endDay);

      // If the event has already passed this year, move it to next year
      const now = new Date();
      if (newEndDate < now) {
        newStartDate = new Date(currentYear + 1, startMonth, startDay);
        newEndDate = new Date(currentYear + 1, endMonth, endDay);
      }

      // Handle events that span across years (like Christmas to New Year)
      if (endMonth < startMonth || (endMonth === startMonth && endDay < startDay)) {
        newEndDate = new Date(newStartDate.getFullYear() + 1, endMonth, endDay);
      }

      return {
        ...period,
        start_date: newStartDate.toISOString().split('T')[0],
        end_date: newEndDate.toISOString().split('T')[0],
      };
    }) || [];

    // Log for debugging
    console.log(`Fetched ${adjustedData.length} seasonal periods from database (adjusted to current year)`);

    return NextResponse.json(adjustedData as SeasonalPeriod[]);
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
