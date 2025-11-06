#!/usr/bin/env node
// jobs/social-metrics-aggregator.ts
// Aggregates social metrics from all platforms into unified keyword metrics
// Combines data from Reddit, Twitter, Pinterest, TikTok

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const LOOKBACK_HOURS = parseInt(process.env.LOOKBACK_HOURS || "24", 10);

// Platform weights for scoring
const PLATFORM_WEIGHTS = {
  reddit: 0.35,     // High signal for long-tail keywords
  twitter: 0.20,    // Fast-moving trends
  pinterest: 0.40,  // Highest purchase intent
  tiktok: 0.05,     // Emerging/viral trends
};

interface KeywordMetrics {
  keyword_id: string;
  term: string;
  platforms: {
    reddit?: PlatformData;
    twitter?: PlatformData;
    pinterest?: PlatformData;
    tiktok?: PlatformData;
  };
  aggregated: {
    total_mentions: number;
    weighted_engagement: number;
    avg_sentiment: number;
    platform_count: number;
    dominant_platform: string;
  };
}

interface PlatformData {
  mentions: number;
  engagement: number;
  sentiment: number;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();
  const cutoffTime = new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();

  console.log(`[${runStarted}] Starting social metrics aggregation ${runId}`);
  console.log(`[INFO] Lookback: ${LOOKBACK_HOURS} hours (since ${cutoffTime})`);

  try {
    // Fetch recent social platform trends
    const { data: platformTrends, error: trendsError } = await supabase
      .from("social_platform_trends")
      .select("*")
      .gte("collected_at", cutoffTime);

    if (trendsError) {
      throw new Error(`Failed to fetch platform trends: ${trendsError.message}`);
    }

    if (!platformTrends || platformTrends.length === 0) {
      console.log("[INFO] No platform trends found in lookback window");
      await logRun(supabase, runId, "success", 0, 0);
      return;
    }

    console.log(`[INFO] Processing ${platformTrends.length} platform trend records`);

    // Group by keyword
    const keywordMap = new Map<string, KeywordMetrics>();

    for (const trend of platformTrends) {
      if (!trend.keyword_id) continue;

      let metrics = keywordMap.get(trend.keyword_id);
      if (!metrics) {
        metrics = {
          keyword_id: trend.keyword_id,
          term: "",
          platforms: {},
          aggregated: {
            total_mentions: 0,
            weighted_engagement: 0,
            avg_sentiment: 0,
            platform_count: 0,
            dominant_platform: "",
          },
        };
        keywordMap.set(trend.keyword_id, metrics);
      }

      const platform = trend.platform as keyof typeof PLATFORM_WEIGHTS;
      metrics.platforms[platform] = {
        mentions: trend.mention_count || 0,
        engagement: trend.engagement_score || 0,
        sentiment: trend.sentiment || 0,
      };
    }

    // Aggregate metrics for each keyword
    for (const [keywordId, metrics] of keywordMap.entries()) {
      let totalMentions = 0;
      let weightedEngagement = 0;
      let sentimentSum = 0;
      let sentimentCount = 0;
      let platformCount = 0;
      let maxEngagement = 0;
      let dominantPlatform = "";

      for (const [platform, data] of Object.entries(metrics.platforms)) {
        totalMentions += data.mentions;
        const weight = PLATFORM_WEIGHTS[platform as keyof typeof PLATFORM_WEIGHTS] || 0.1;
        weightedEngagement += data.engagement * weight;

        if (data.sentiment !== 0) {
          sentimentSum += data.sentiment;
          sentimentCount++;
        }

        platformCount++;

        if (data.engagement > maxEngagement) {
          maxEngagement = data.engagement;
          dominantPlatform = platform;
        }
      }

      metrics.aggregated = {
        total_mentions: totalMentions,
        weighted_engagement: Number(weightedEngagement.toFixed(2)),
        avg_sentiment: sentimentCount > 0 ? Number((sentimentSum / sentimentCount).toFixed(2)) : 0,
        platform_count: platformCount,
        dominant_platform: dominantPlatform,
      };

      // Get keyword term for logging
      const { data: keyword } = await supabase
        .from("keywords")
        .select("term")
        .eq("id", keywordId)
        .single();

      if (keyword) {
        metrics.term = keyword.term;
      }
    }

    console.log(`[INFO] Aggregated metrics for ${keywordMap.size} keywords`);

    // Update keywords table with aggregated social signals
    let updatedCount = 0;
    const today = new Date().toISOString().split("T")[0];

    for (const [keywordId, metrics] of keywordMap.entries()) {
      try {
        // Update keyword extras with social signals
        const { data: keyword } = await supabase
          .from("keywords")
          .select("extras")
          .eq("id", keywordId)
          .single();

        const extras = keyword?.extras && typeof keyword.extras === "object"
          ? { ...keyword.extras }
          : {};

        extras.social = {
          total_mentions: metrics.aggregated.total_mentions,
          weighted_engagement: metrics.aggregated.weighted_engagement,
          avg_sentiment: metrics.aggregated.avg_sentiment,
          platform_count: metrics.aggregated.platform_count,
          dominant_platform: metrics.aggregated.dominant_platform,
          platforms: Object.keys(metrics.platforms),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("keywords")
          .update({ extras })
          .eq("id", keywordId);

        if (updateError) {
          console.warn(`[WARN] Failed to update keyword ${keywordId}: ${updateError.message}`);
          continue;
        }

        // Also update or create aggregated social metric in keyword_metrics_daily
        const { error: metricsError } = await supabase
          .from("keyword_metrics_daily")
          .upsert(
            {
              keyword_id: keywordId,
              collected_on: today,
              source: "social_aggregate",
              social_mentions: metrics.aggregated.total_mentions,
              social_sentiment: metrics.aggregated.avg_sentiment,
              social_platforms: Object.fromEntries(
                Object.entries(metrics.platforms).map(([platform, data]) => [
                  platform,
                  data.mentions,
                ])
              ),
              extras: {
                weighted_engagement: metrics.aggregated.weighted_engagement,
                platform_count: metrics.aggregated.platform_count,
                dominant_platform: metrics.aggregated.dominant_platform,
              },
            },
            { onConflict: "keyword_id,collected_on,source" }
          );

        if (metricsError) {
          console.warn(`[WARN] Failed to upsert metrics for keyword ${keywordId}: ${metricsError.message}`);
          continue;
        }

        updatedCount++;

        if (updatedCount % 50 === 0) {
          console.log(`[INFO] Progress: ${updatedCount}/${keywordMap.size} keywords updated`);
        }
      } catch (err) {
        console.error(`[ERROR] Processing keyword ${keywordId}:`, err);
      }
    }

    console.log(`[INFO] Successfully updated ${updatedCount}/${keywordMap.size} keywords`);

    // Log top keywords by engagement
    const topKeywords = Array.from(keywordMap.values())
      .sort((a, b) => b.aggregated.weighted_engagement - a.aggregated.weighted_engagement)
      .slice(0, 10);

    console.log("\n[INFO] Top 10 keywords by social engagement:");
    for (const kw of topKeywords) {
      console.log(
        `  - ${kw.term || kw.keyword_id}: ${kw.aggregated.weighted_engagement} ` +
        `(${kw.aggregated.total_mentions} mentions, ${kw.aggregated.platform_count} platforms, ` +
        `sentiment: ${kw.aggregated.avg_sentiment.toFixed(2)})`
      );
    }

    await logRun(supabase, runId, "success", keywordMap.size, updatedCount);

    console.log(`[INFO] Social metrics aggregation ${runId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Social metrics aggregation failed: ${errorMessage}`);
    await logRun(supabase, runId, "error", 0, 0, errorMessage);
    process.exit(1);
  }
}

async function logRun(
  supabase: any,
  runId: string,
  status: string,
  keywordsProcessed: number,
  keywordsUpdated: number,
  error: string | null = null
) {
  await supabase.from("job_runs").insert({
    id: runId,
    job_name: "social-metrics-aggregation",
    status,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    metadata: {
      keywords_processed: keywordsProcessed,
      keywords_updated: keywordsUpdated,
      lookback_hours: LOOKBACK_HOURS,
      platform_weights: PLATFORM_WEIGHTS,
      error,
    },
  });
}

main();
