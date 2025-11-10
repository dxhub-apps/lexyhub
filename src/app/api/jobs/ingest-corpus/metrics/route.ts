/**
 * API Endpoint: Ingest Metrics to ai_corpus
 *
 * POST /api/jobs/ingest-corpus/metrics
 *
 * Runs the metric ingestion job to populate ai_corpus from keyword_metrics_*
 * Requires service role authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

const BATCH_SIZE = 50;
const LOOKBACK_DAYS = 7;

interface Keyword {
  id: string;
  term: string;
  marketplace: string | null;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  engagement_score: number | null;
  ai_opportunity_score: number | null;
}

interface DailyMetric {
  keyword_id: string;
  collected_on: string;
  demand: number | null;
  supply: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  social_mentions: number | null;
  social_sentiment: number | null;
}

interface WeeklyMetric {
  keyword_id: string;
  week_start: string;
  source: string | null;
  metrics: Record<string, unknown>;
}

function createMetricChunk(keyword: Keyword, dailyMetrics: DailyMetric[], weeklyMetrics: WeeklyMetric[]): string {
  const parts: string[] = [];

  parts.push(`Keyword: "${keyword.term}"`);
  if (keyword.marketplace) {
    parts.push(`Marketplace: ${keyword.marketplace}`);
  }

  const currentMetrics: string[] = [];
  if (keyword.demand_index !== null) currentMetrics.push(`Demand Index: ${keyword.demand_index.toFixed(2)}`);
  if (keyword.competition_score !== null) currentMetrics.push(`Competition Score: ${keyword.competition_score.toFixed(2)}`);
  if (keyword.trend_momentum !== null) currentMetrics.push(`Trend Momentum: ${keyword.trend_momentum.toFixed(2)}`);
  if (keyword.engagement_score !== null) currentMetrics.push(`Engagement Score: ${keyword.engagement_score.toFixed(2)}`);
  if (keyword.ai_opportunity_score !== null) currentMetrics.push(`AI Opportunity Score: ${keyword.ai_opportunity_score.toFixed(2)}`);

  if (currentMetrics.length > 0) {
    parts.push(`Current Metrics: ${currentMetrics.join(", ")}`);
  }

  if (dailyMetrics.length > 0) {
    const recentDaily = dailyMetrics.slice(0, 7);
    const dailySummary = recentDaily.map((m) => {
      const date = new Date(m.collected_on).toISOString().split("T")[0];
      const metrics: string[] = [];
      if (m.demand !== null) metrics.push(`demand=${m.demand.toFixed(0)}`);
      if (m.supply !== null) metrics.push(`supply=${m.supply.toFixed(0)}`);
      if (m.competition_score !== null) metrics.push(`competition=${m.competition_score.toFixed(2)}`);
      return `${date}: ${metrics.join(", ")}`;
    });
    parts.push(`Recent Daily Trends: ${dailySummary.join("; ")}`);
  }

  if (weeklyMetrics.length > 0) {
    const recentWeekly = weeklyMetrics.slice(0, 4);
    parts.push(`Weekly Data Points: ${recentWeekly.length} weeks of historical data available`);
  }

  return parts.join(". ");
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
      return NextResponse.json(
        { error: "Unauthorized - Service role key required" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Get keywords
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, term, marketplace, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score")
      .not("marketplace", "is", null)
      .gte("updated_at", lookbackDate.toISOString())
      .order("updated_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No keywords found for ingestion",
        processed: 0,
        duration: Date.now() - startTime,
      });
    }

    const keywordIds = keywords.map((k) => k.id);

    // Fetch metrics
    const { data: dailyMetrics } = await supabase
      .from("keyword_metrics_daily")
      .select("keyword_id, collected_on, demand, supply, competition_score, trend_momentum, social_mentions, social_sentiment")
      .in("keyword_id", keywordIds)
      .gte("collected_on", lookbackDate.toISOString())
      .order("collected_on", { ascending: false });

    const { data: weeklyMetrics } = await supabase
      .from("keyword_metrics_weekly")
      .select("keyword_id, week_start, source, metrics")
      .in("keyword_id", keywordIds)
      .order("week_start", { ascending: false })
      .limit(BATCH_SIZE * 4);

    // Group metrics
    const dailyByKeyword = new Map<string, DailyMetric[]>();
    (dailyMetrics || []).forEach((m) => {
      if (!dailyByKeyword.has(m.keyword_id)) dailyByKeyword.set(m.keyword_id, []);
      dailyByKeyword.get(m.keyword_id)!.push(m as DailyMetric);
    });

    const weeklyByKeyword = new Map<string, WeeklyMetric[]>();
    (weeklyMetrics || []).forEach((m) => {
      if (!weeklyByKeyword.has(m.keyword_id)) weeklyByKeyword.set(m.keyword_id, []);
      weeklyByKeyword.get(m.keyword_id)!.push(m as WeeklyMetric);
    });

    // Process keywords
    let successCount = 0;
    let errorCount = 0;

    for (const keyword of keywords as Keyword[]) {
      try {
        const daily = dailyByKeyword.get(keyword.id) || [];
        const weekly = weeklyByKeyword.get(keyword.id) || [];

        const chunk = createMetricChunk(keyword, daily, weekly);
        const embedding = await createSemanticEmbedding(chunk, { fallbackToDeterministic: true });

        const { error: upsertError } = await supabase.from("ai_corpus").upsert({
          id: crypto.randomUUID(),
          owner_scope: "global",
          owner_user_id: null,
          owner_team_id: null,
          source_type: "keyword_metrics",
          source_ref: {
            keyword_id: keyword.id,
            daily_count: daily.length,
            weekly_count: weekly.length,
            ingested_at: new Date().toISOString(),
          },
          marketplace: keyword.marketplace,
          language: "en",
          chunk,
          embedding: JSON.stringify(embedding),
          metadata: {
            keyword_term: keyword.term,
            demand_index: keyword.demand_index,
            competition_score: keyword.competition_score,
            trend_momentum: keyword.trend_momentum,
            ai_opportunity_score: keyword.ai_opportunity_score,
          },
          is_active: true,
        }, { onConflict: "id", ignoreDuplicates: false });

        if (upsertError) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: keywords.length,
      successCount,
      errorCount,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
