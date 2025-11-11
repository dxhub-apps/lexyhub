#!/usr/bin/env node
/**
 * Metric Ingestion to ai_corpus Job
 *
 * Reads keyword_metrics_daily and keyword_metrics_weekly tables
 * Creates factual chunks and upserts into ai_corpus with embeddings
 *
 * Run: node --loader ts-node/esm jobs/ingest-metrics-to-corpus.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "50", 10);
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || "7", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

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

  // Header
  parts.push(`Keyword: "${keyword.term}"`);
  if (keyword.marketplace) {
    parts.push(`Marketplace: ${keyword.marketplace}`);
  }

  // Current snapshot metrics
  const currentMetrics: string[] = [];
  if (keyword.demand_index !== null) {
    currentMetrics.push(`Demand Index: ${keyword.demand_index.toFixed(2)}`);
  }
  if (keyword.competition_score !== null) {
    currentMetrics.push(`Competition Score: ${keyword.competition_score.toFixed(2)}`);
  }
  if (keyword.trend_momentum !== null) {
    currentMetrics.push(`Trend Momentum: ${keyword.trend_momentum.toFixed(2)}`);
  }
  if (keyword.engagement_score !== null) {
    currentMetrics.push(`Engagement Score: ${keyword.engagement_score.toFixed(2)}`);
  }
  if (keyword.ai_opportunity_score !== null) {
    currentMetrics.push(`AI Opportunity Score: ${keyword.ai_opportunity_score.toFixed(2)}`);
  }

  if (currentMetrics.length > 0) {
    parts.push(`Current Metrics: ${currentMetrics.join(", ")}`);
  }

  // Recent daily metrics (last 7 days)
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

  // Weekly aggregates
  if (weeklyMetrics.length > 0) {
    const recentWeekly = weeklyMetrics.slice(0, 4);
    parts.push(`Weekly Data Points: ${recentWeekly.length} weeks of historical data available`);
  }

  return parts.join(". ");
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting metric ingestion to ai_corpus ${runId}`);
  console.log(`[INFO] Batch size: ${BATCH_SIZE}, Lookback: ${LOOKBACK_DAYS} days`);

  try {
    // Get keywords with recent activity
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    console.log(`[INFO] Fetching keywords updated since ${lookbackDate.toISOString()}, limit ${BATCH_SIZE}...`);
    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, term, marketplace, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score")
      .not("marketplace", "is", null)
      .gte("updated_at", lookbackDate.toISOString())
      .order("updated_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (keywordsError) {
      console.error("[ERROR] Failed to fetch keywords:", keywordsError);
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      console.log("[INFO] No keywords found for ingestion");
      return;
    }

    console.log(`[INFO] Found ${keywords.length} keywords to process`);

    const keywordIds = keywords.map((k) => k.id);

    // Fetch daily metrics
    console.log(`[INFO] Fetching daily metrics for ${keywordIds.length} keywords...`);
    const { data: dailyMetrics, error: dailyError } = await supabase
      .from("keyword_metrics_daily")
      .select("keyword_id, collected_on, demand, supply, competition_score, trend_momentum, social_mentions, social_sentiment")
      .in("keyword_id", keywordIds)
      .gte("collected_on", lookbackDate.toISOString())
      .order("collected_on", { ascending: false });

    if (dailyError) {
      console.warn(`[WARN] Failed to fetch daily metrics: ${dailyError.message}`);
    } else {
      console.log(`[INFO] Found ${dailyMetrics?.length || 0} daily metric records`);
    }

    // Fetch weekly metrics
    console.log(`[INFO] Fetching weekly metrics for ${keywordIds.length} keywords...`);
    const { data: weeklyMetrics, error: weeklyError } = await supabase
      .from("keyword_metrics_weekly")
      .select("keyword_id, week_start, source, metrics")
      .in("keyword_id", keywordIds)
      .order("week_start", { ascending: false })
      .limit(BATCH_SIZE * 4); // 4 weeks per keyword

    if (weeklyError) {
      console.warn(`[WARN] Failed to fetch weekly metrics: ${weeklyError.message}`);
    } else {
      console.log(`[INFO] Found ${weeklyMetrics?.length || 0} weekly metric records`);
    }

    // Group metrics by keyword
    const dailyByKeyword = new Map<string, DailyMetric[]>();
    (dailyMetrics || []).forEach((m) => {
      if (!dailyByKeyword.has(m.keyword_id)) {
        dailyByKeyword.set(m.keyword_id, []);
      }
      dailyByKeyword.get(m.keyword_id)!.push(m as DailyMetric);
    });

    const weeklyByKeyword = new Map<string, WeeklyMetric[]>();
    (weeklyMetrics || []).forEach((m) => {
      if (!weeklyByKeyword.has(m.keyword_id)) {
        weeklyByKeyword.set(m.keyword_id, []);
      }
      weeklyByKeyword.get(m.keyword_id)!.push(m as WeeklyMetric);
    });

    // Process each keyword
    let successCount = 0;
    let errorCount = 0;

    console.log(`[INFO] Processing ${keywords.length} keywords with embeddings...`);
    for (const keyword of keywords as Keyword[]) {
      try {
        const daily = dailyByKeyword.get(keyword.id) || [];
        const weekly = weeklyByKeyword.get(keyword.id) || [];

        console.log(`[INFO] Processing keyword "${keyword.term}" (${keyword.id}): ${daily.length} daily, ${weekly.length} weekly metrics`);

        // Create factual chunk
        const chunk = createMetricChunk(keyword, daily, weekly);
        console.log(`[INFO] Created chunk for "${keyword.term}" (${chunk.length} chars)`);

        // Generate semantic embedding
        const embedding = await createSemanticEmbedding(chunk, {
          fallbackToDeterministic: true,
        });
        console.log(`[INFO] Generated embedding for "${keyword.term}" (${embedding.length} dimensions)`);

        // Validate embedding dimension
        if (embedding.length !== 384) {
          console.error(
            `[ERROR] Invalid embedding dimension for keyword ${keyword.id} "${keyword.term}": expected 384, got ${embedding.length}`
          );
          errorCount++;
          continue;
        }

        // Upsert to ai_corpus
        const { error: upsertError } = await supabase
          .from("ai_corpus")
          .upsert({
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
            embedding: embedding, // Pass array directly, not JSON.stringify
            metadata: {
              keyword_term: keyword.term,
              demand_index: keyword.demand_index,
              competition_score: keyword.competition_score,
              trend_momentum: keyword.trend_momentum,
              ai_opportunity_score: keyword.ai_opportunity_score,
            },
            is_active: true,
          }, {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[ERROR] Failed to upsert keyword ${keyword.id} "${keyword.term}":`, {
            keyword_id: keyword.id,
            keyword_term: keyword.term,
            error_code: upsertError.code,
            error_message: upsertError.message,
            error_details: upsertError.details,
            error_hint: upsertError.hint,
            embedding_length: embedding.length,
            chunk_length: chunk.length,
            marketplace: keyword.marketplace,
          });
          errorCount++;
        } else {
          successCount++;
          console.log(`[INFO] ✓ Successfully inserted keyword "${keyword.term}" (${successCount}/${keywords.length})`);
        }
      } catch (error) {
        console.error(`[ERROR] Exception processing keyword ${keyword.id} "${keyword.term}":`, error);
        errorCount++;
      }
    }

    console.log(`[INFO] Processing complete: ${successCount} success, ${errorCount} errors out of ${keywords.length} total`);

    const runEnded = new Date().toISOString();
    const duration = new Date(runEnded).getTime() - new Date(runStarted).getTime();

    console.log(`[${runEnded}] Metric ingestion completed`);
    console.log(`[INFO] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[INFO] Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error(`[ERROR] Fatal error in metric ingestion: ${error}`);
    process.exit(1);
  }
}

main();
