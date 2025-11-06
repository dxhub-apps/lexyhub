// src/app/api/trends/social/route.ts
// API endpoint for multi-platform social trending keywords

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface TrendingKeyword {
  keyword_id: string;
  term: string;
  market?: string;
  platform_count: number;
  platforms: string[];
  total_mentions: number;
  weighted_engagement: number;
  avg_sentiment: number;
  trend_momentum: number;
  platform_breakdown: Record<string, {
    mentions: number;
    engagement: number;
    sentiment: number;
  }>;
  last_collected: string;
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const minPlatforms = parseInt(searchParams.get("min_platforms") || "2");
    const sentiment = searchParams.get("sentiment"); // 'positive', 'negative', 'neutral', or null
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const lookbackDays = parseInt(searchParams.get("lookback_days") || "7");

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Query keywords with social metrics from multiple platforms
    const { data: socialTrends, error: trendsError } = await supabase
      .from("keyword_metrics_daily")
      .select(`
        keyword_id,
        collected_on,
        social_mentions,
        social_sentiment,
        social_engagement_score,
        social_platforms,
        keywords (
          id,
          term,
          market,
          trend_momentum,
          adjusted_demand_index
        )
      `)
      .gte("collected_on", startDate.toISOString().split("T")[0])
      .lte("collected_on", endDate.toISOString().split("T")[0])
      .not("social_platforms", "is", null)
      .order("collected_on", { ascending: false });

    if (trendsError) {
      console.error("Error fetching social trends:", trendsError);
      return NextResponse.json(
        { error: "Failed to fetch social trends" },
        { status: 500 }
      );
    }

    if (!socialTrends || socialTrends.length === 0) {
      const response = NextResponse.json({ trends: [] });
      response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
      return response;
    }

    // Aggregate by keyword_id (most recent data per keyword)
    const keywordMap = new Map<string, TrendingKeyword>();

    for (const row of socialTrends) {
      const keyword = row.keywords as any;
      if (!keyword) continue;

      const platforms = row.social_platforms as Record<string, number> || {};
      const platformNames = Object.keys(platforms);
      const platformCount = platformNames.length;

      // Skip if doesn't meet minimum platform requirement
      if (platformCount < minPlatforms) continue;

      // Apply sentiment filter if specified
      const avgSentiment = row.social_sentiment || 0;
      if (sentiment) {
        if (sentiment === "positive" && avgSentiment <= 0.2) continue;
        if (sentiment === "negative" && avgSentiment >= -0.2) continue;
        if (sentiment === "neutral" && Math.abs(avgSentiment) > 0.2) continue;
      }

      // Only keep most recent data per keyword
      if (!keywordMap.has(row.keyword_id)) {
        // Get detailed platform breakdown
        const { data: platformDetails } = await supabase
          .from("social_platform_trends")
          .select("platform, mentions, engagement_score, sentiment_score")
          .eq("keyword_id", row.keyword_id)
          .gte("collected_on", startDate.toISOString().split("T")[0])
          .lte("collected_on", endDate.toISOString().split("T")[0]);

        const platformBreakdown: Record<string, any> = {};
        if (platformDetails) {
          for (const detail of platformDetails) {
            if (!platformBreakdown[detail.platform]) {
              platformBreakdown[detail.platform] = {
                mentions: 0,
                engagement: 0,
                sentiment: 0,
              };
            }
            platformBreakdown[detail.platform].mentions += detail.mentions || 0;
            platformBreakdown[detail.platform].engagement += detail.engagement_score || 0;
            platformBreakdown[detail.platform].sentiment = detail.sentiment_score || 0;
          }
        }

        keywordMap.set(row.keyword_id, {
          keyword_id: row.keyword_id,
          term: keyword.term,
          market: keyword.market,
          platform_count: platformCount,
          platforms: platformNames,
          total_mentions: row.social_mentions || 0,
          weighted_engagement: row.social_engagement_score || 0,
          avg_sentiment: avgSentiment,
          trend_momentum: keyword.trend_momentum || 0,
          platform_breakdown: platformBreakdown,
          last_collected: row.collected_on,
        });
      }
    }

    // Convert to array and sort by weighted engagement
    let trends = Array.from(keywordMap.values());
    trends.sort((a, b) => b.weighted_engagement - a.weighted_engagement);
    trends = trends.slice(0, limit);

    const response = NextResponse.json({
      trends,
      meta: {
        count: trends.length,
        min_platforms: minPlatforms,
        sentiment_filter: sentiment,
        lookback_days: lookbackDays,
      },
    });

    // Cache for 5 minutes (social trends update hourly)
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

    return response;
  } catch (error) {
    console.error("Error in social trends endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
