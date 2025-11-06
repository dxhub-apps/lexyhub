// src/app/api/keywords/[id]/social/route.ts
// API endpoint for keyword-specific social media metrics

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

interface PlatformMetric {
  platform: string;
  mentions: number;
  engagement_score: number;
  sentiment_score: number;
  collected_on: string;
  trending_subreddits?: string[];
  trending_hashtags?: string[];
  trending_categories?: string[];
  top_posts?: Array<{
    title?: string;
    text?: string;
    url?: string;
    engagement: number;
  }>;
}

interface SocialMetricsResponse {
  keyword_id: string;
  term: string;
  market?: string;
  summary: {
    total_platforms: number;
    total_mentions: number;
    avg_sentiment: number;
    weighted_engagement: number;
    trend_momentum: number;
  };
  platforms: PlatformMetric[];
  daily_history: Array<{
    date: string;
    mentions: number;
    sentiment: number;
    engagement: number;
    platforms: Record<string, number>;
  }>;
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const lookbackDays = parseInt(searchParams.get("lookback_days") || "30");
    const includePosts = searchParams.get("include_posts") === "true";

    const keywordId = params.id;

    // Validate keyword exists
    const { data: keyword, error: keywordError } = await supabase
      .from("keywords")
      .select("id, term, market, trend_momentum, adjusted_demand_index")
      .eq("id", keywordId)
      .single();

    if (keywordError || !keyword) {
      return NextResponse.json(
        { error: "Keyword not found" },
        { status: 404 }
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Get platform-specific trends
    const { data: platformTrends, error: trendsError } = await supabase
      .from("social_platform_trends")
      .select("*")
      .eq("keyword_id", keywordId)
      .gte("collected_on", startDate.toISOString().split("T")[0])
      .lte("collected_on", endDate.toISOString().split("T")[0])
      .order("collected_on", { ascending: false });

    if (trendsError) {
      console.error("Error fetching platform trends:", trendsError);
      return NextResponse.json(
        { error: "Failed to fetch platform trends" },
        { status: 500 }
      );
    }

    // Get daily aggregated metrics
    const { data: dailyMetrics, error: dailyError } = await supabase
      .from("keyword_metrics_daily")
      .select("collected_on, social_mentions, social_sentiment, social_engagement_score, social_platforms")
      .eq("keyword_id", keywordId)
      .gte("collected_on", startDate.toISOString().split("T")[0])
      .lte("collected_on", endDate.toISOString().split("T")[0])
      .order("collected_on", { ascending: false });

    if (dailyError) {
      console.error("Error fetching daily metrics:", dailyError);
    }

    // Aggregate platform metrics
    const platformMap = new Map<string, PlatformMetric>();
    let totalMentions = 0;
    let totalEngagement = 0;
    let totalSentiment = 0;
    let sentimentCount = 0;

    if (platformTrends) {
      for (const trend of platformTrends) {
        const platform = trend.platform;

        if (!platformMap.has(platform)) {
          platformMap.set(platform, {
            platform,
            mentions: 0,
            engagement_score: 0,
            sentiment_score: 0,
            collected_on: trend.collected_on,
            trending_subreddits: [],
            trending_hashtags: [],
            trending_categories: [],
            top_posts: [],
          });
        }

        const metric = platformMap.get(platform)!;
        metric.mentions += trend.mentions || 0;
        metric.engagement_score += trend.engagement_score || 0;

        if (trend.sentiment_score !== null) {
          metric.sentiment_score = trend.sentiment_score;
          sentimentCount++;
        }

        // Update date to most recent
        if (trend.collected_on > metric.collected_on) {
          metric.collected_on = trend.collected_on;
        }

        // Aggregate platform-specific data
        if (trend.metadata) {
          const metadata = trend.metadata as any;

          if (metadata.subreddits && Array.isArray(metadata.subreddits)) {
            metric.trending_subreddits = [
              ...(metric.trending_subreddits || []),
              ...metadata.subreddits
            ].slice(0, 10); // Top 10
          }

          if (metadata.hashtags && Array.isArray(metadata.hashtags)) {
            metric.trending_hashtags = [
              ...(metric.trending_hashtags || []),
              ...metadata.hashtags
            ].slice(0, 10);
          }

          if (metadata.categories && Array.isArray(metadata.categories)) {
            metric.trending_categories = [
              ...(metric.trending_categories || []),
              ...metadata.categories
            ].slice(0, 5);
          }

          if (includePosts && metadata.top_posts && Array.isArray(metadata.top_posts)) {
            metric.top_posts = [
              ...(metric.top_posts || []),
              ...metadata.top_posts
            ].slice(0, 5); // Top 5 posts
          }
        }

        totalMentions += trend.mentions || 0;
        totalEngagement += trend.engagement_score || 0;
        totalSentiment += trend.sentiment_score || 0;
      }
    }

    const platforms = Array.from(platformMap.values());
    const avgSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;

    // Format daily history
    const dailyHistory = (dailyMetrics || []).map(day => ({
      date: day.collected_on,
      mentions: day.social_mentions || 0,
      sentiment: day.social_sentiment || 0,
      engagement: day.social_engagement_score || 0,
      platforms: (day.social_platforms as Record<string, number>) || {},
    }));

    const responseData: SocialMetricsResponse = {
      keyword_id: keyword.id,
      term: keyword.term,
      market: keyword.market,
      summary: {
        total_platforms: platforms.length,
        total_mentions: totalMentions,
        avg_sentiment: avgSentiment,
        weighted_engagement: totalEngagement,
        trend_momentum: keyword.trend_momentum || 0,
      },
      platforms,
      daily_history: dailyHistory,
    };

    const response = NextResponse.json(responseData);

    // Cache for 5 minutes (social metrics update hourly)
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

    return response;
  } catch (error) {
    console.error("Error in keyword social metrics endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
