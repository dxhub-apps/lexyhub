import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface QueryParams {
  q?: string;
  market?: string;
  country?: string;
  minDI?: number;
  minTM?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const params: QueryParams = {
      q: searchParams.get("q") || undefined,
      market: searchParams.get("market") || undefined,
      country: searchParams.get("country") || undefined,
      minDI: searchParams.get("minDI")
        ? parseFloat(searchParams.get("minDI")!)
        : undefined,
      minTM: searchParams.get("minTM")
        ? parseFloat(searchParams.get("minTM")!)
        : undefined,
      sort: searchParams.get("sort") || "adjusted_demand_index.desc",
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : 100,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : 0,
    };

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let query = supabase.from("v_keywords_scored").select("*", { count: "exact" });

    // Apply filters
    if (params.q) {
      query = query.ilike("term", `%${params.q}%`);
    }

    if (params.market) {
      query = query.eq("market", params.market);
    }

    if (params.country) {
      query = query.eq("seasonal_label", params.country);
    }

    if (params.minDI !== undefined) {
      query = query.gte("adjusted_demand_index", params.minDI);
    }

    if (params.minTM !== undefined) {
      query = query.gte("trend_momentum", params.minTM);
    }

    // Apply sorting
    const [sortField, sortOrder] = params.sort!.split(".");
    query = query.order(sortField, {
      ascending: sortOrder === "asc",
      nullsFirst: false,
    });

    // Apply pagination
    query = query.range(params.offset!, params.offset! + params.limit! - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("[ERROR] Failed to fetch keywords:", error);
      return NextResponse.json(
        { error: "Failed to fetch keywords", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        data,
        count,
        limit: params.limit,
        offset: params.offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ERROR] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
