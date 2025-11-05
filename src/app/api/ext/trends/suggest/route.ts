// src/app/api/ext/trends/suggest/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface TrendSuggestPayload {
  term: string;
  market: string;
  limit?: number;
}

export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit
  if (!checkRateLimit(context.userId, 200, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: TrendSuggestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { term, market, limit = 10 } = payload;

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // Get trending terms from community signals
    const { data: trendingData, error: trendingError } = await supabase
      .rpc("get_trending_terms", {
        p_market: market,
        p_days: 7,
        p_limit: limit,
      });

    if (trendingError) {
      console.error("Error fetching trending terms:", trendingError);
    }

    // Get related keywords from concept clusters
    const { data: relatedData, error: relatedError } = await supabase
      .from("keywords")
      .select("term, ai_opportunity_score, trend_momentum, freshness_ts")
      .eq("market", market)
      .ilike("term", `%${term}%`)
      .order("ai_opportunity_score", { ascending: false })
      .limit(limit);

    if (relatedError) {
      console.error("Error fetching related keywords:", relatedError);
    }

    // Combine and format suggestions
    const suggestions = (relatedData || []).map((row) => ({
      term: row.term,
      ai_score: row.ai_opportunity_score || 0,
      trend: row.trend_momentum || 0,
      freshness_days: calculateDaysSince(row.freshness_ts),
    }));

    // Add trending terms if available
    if (trendingData && trendingData.length > 0) {
      trendingData.forEach((trending: any) => {
        if (!suggestions.find((s) => s.term === trending.term)) {
          suggestions.push({
            term: trending.term,
            ai_score: 0,
            trend: trending.trend_score || 0,
            freshness_days: 0,
          });
        }
      });
    }

    // Sort by trend score
    suggestions.sort((a, b) => b.trend - a.trend);

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, limit),
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/trends/suggest:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function calculateDaysSince(timestamp: string | null): number {
  if (!timestamp) return 999;

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export const runtime = "nodejs";
