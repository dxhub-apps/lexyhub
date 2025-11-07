// src/app/api/keywords/[term]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type KeywordRow = {
  id?: string;
  term: string;
  market: string;
  source: string;
  tier?: string | number;
  method?: string | null;
  extras?: Record<string, unknown> | null;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  base_demand_index?: number | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  seasonal_label?: string | null;
};

/**
 * GET /api/keywords/[term]?market=us
 * Fetch a single keyword by term and market
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { term: string } }
) {
  try {
    const { term } = params;
    const { searchParams } = new URL(request.url);
    const market = searchParams.get("market") || "us";
    const source = searchParams.get("source"); // optional: filter by source

    if (!term) {
      return NextResponse.json(
        { error: "Term parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      );
    }

    // Try exact match first using RPC function
    const { data: exactMatch, error: rpcError } = await supabase.rpc(
      "lexy_lower_eq_keyword",
      {
        p_market: market,
        p_term: term,
      }
    );

    if (rpcError) {
      console.error("Error fetching keyword via RPC:", rpcError);
    }

    if (exactMatch && exactMatch.length > 0) {
      // If source filter is specified, filter the results
      const filtered = source
        ? exactMatch.filter((k: any) => k.source === source)
        : exactMatch;

      if (filtered.length > 0) {
        return NextResponse.json({
          keyword: coerceKeyword(filtered[0]),
          allSources: exactMatch.map((k: any) => coerceKeyword(k)),
        });
      }
    }

    // Fallback: search by ILIKE
    const selectColumns =
      "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label";

    let queryBuilder = supabase
      .from("keywords")
      .select(selectColumns)
      .eq("market", market)
      .ilike("term", term)
      .limit(10);

    if (source) {
      queryBuilder = queryBuilder.eq("source", source);
    }

    const { data: keywords, error: queryError } = await queryBuilder;

    if (queryError) {
      console.error("Error fetching keyword:", queryError);
      return NextResponse.json(
        { error: "Failed to fetch keyword" },
        { status: 500 }
      );
    }

    if (!keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: "Keyword not found" },
        { status: 404 }
      );
    }

    // Find exact match (case-insensitive)
    const exactMatchKeyword = keywords.find(
      (k: any) => k.term.toLowerCase() === term.toLowerCase()
    );

    return NextResponse.json({
      keyword: coerceKeyword(exactMatchKeyword || keywords[0]),
      allSources: keywords.map((k: any) => coerceKeyword(k)),
    });
  } catch (err) {
    console.error("Unexpected error in keyword fetch:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function coerceKeyword(row: any): KeywordRow {
  return {
    id: row?.id ?? undefined,
    term: String(row.term),
    market: String(row.market),
    source: String(row.source),
    tier: row?.tier ?? undefined,
    method: row?.method ?? null,
    extras: row?.extras ?? null,
    trend_momentum: row?.trend_momentum ?? null,
    ai_opportunity_score: row?.ai_opportunity_score ?? null,
    demand_index: row?.demand_index ?? null,
    competition_score: row?.competition_score ?? null,
    engagement_score: row?.engagement_score ?? null,
    freshness_ts: row?.freshness_ts ?? null,
    base_demand_index: row?.base_demand_index ?? null,
    adjusted_demand_index: row?.adjusted_demand_index ?? null,
    deseasoned_trend_momentum: row?.deseasoned_trend_momentum ?? null,
    seasonal_label: row?.seasonal_label ?? null,
  };
}
