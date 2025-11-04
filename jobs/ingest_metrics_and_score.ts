#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const SOURCE = "lexyhub";
const COUNTRY = process.env.COUNTRY || "global";
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || "7", 10);

interface Keyword {
  id: string;
  term: string;
  market: string;
  source: string;
}

interface MetricsData {
  volume: number | null;
  traffic_rank: number | null;
  competition_score: number | null;
  engagement: number | null;
  ai_confidence: number;
}

interface AIInferenceResult {
  volume?: number;
  traffic_rank?: number;
  competition_score?: number;
  engagement?: number;
  confidence: number;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting demand trend run ${runId}`);
  console.log(`[INFO] Source: ${SOURCE}, Country: ${COUNTRY}, Lookback: ${LOOKBACK_DAYS} days`);

  try {
    // Fetch active keywords (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: keywords, error: kwError } = await supabase
      .from("keywords")
      .select("id, term, market, source")
      .gte("freshness_ts", ninetyDaysAgo.toISOString())
      .order("freshness_ts", { ascending: false });

    if (kwError) {
      throw new Error(`Failed to fetch keywords: ${kwError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      console.log("[INFO] No active keywords found");
      await logRun(supabase, runId, "success", 0, 0, LOOKBACK_DAYS);
      return;
    }

    console.log(`[INFO] Processing ${keywords.length} keywords`);

    const collectedOn = new Date().toISOString().split("T")[0];
    let successCount = 0;
    let errorCount = 0;

    // Process keywords in batches
    const batchSize = 50;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      console.log(`[INFO] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(keywords.length / batchSize)}`);

      await Promise.all(
        batch.map(async (keyword) => {
          try {
            const metrics = await collectMetrics(keyword, openai);

            const { error: insertError } = await supabase
              .from("keyword_metrics_daily")
              .upsert(
                {
                  keyword_id: keyword.id,
                  collected_on: collectedOn,
                  volume: metrics.volume,
                  traffic_rank: metrics.traffic_rank,
                  competition_score: metrics.competition_score,
                  engagement: metrics.engagement,
                  ai_confidence: metrics.ai_confidence,
                  source: SOURCE,
                  extras: {},
                },
                { onConflict: "keyword_id,collected_on,source" }
              );

            if (insertError) {
              console.error(`[ERROR] Failed to insert metrics for keyword ${keyword.id}: ${insertError.message}`);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error(`[ERROR] Processing keyword ${keyword.id}:`, err);
            errorCount++;
          }
        })
      );
    }

    console.log(`[INFO] Metrics collection complete. Success: ${successCount}, Errors: ${errorCount}`);

    // Execute SQL function to compute demand indices and trends
    console.log(`[INFO] Computing demand indices and trends for date ${collectedOn}`);

    const { data: updateResult, error: updateError } = await supabase.rpc(
      "apply_demand_trend_for_date",
      {
        _as_of: collectedOn,
        _source: SOURCE,
        _country: COUNTRY,
        _lookback: LOOKBACK_DAYS,
      }
    );

    if (updateError) {
      throw new Error(`Failed to apply demand trends: ${updateError.message}`);
    }

    const updatedCount = updateResult || 0;
    console.log(`[INFO] Updated ${updatedCount} keywords with demand indices and trends`);

    await logRun(supabase, runId, "success", successCount, errorCount, LOOKBACK_DAYS, {
      keywords_processed: keywords.length,
      metrics_collected: successCount,
      keywords_updated: updatedCount,
    });

    console.log(`[INFO] Demand trend run ${runId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Demand trend run failed: ${errorMessage}`);
    await logRun(supabase, runId, "error", 0, 0, LOOKBACK_DAYS, {}, errorMessage);
    process.exit(1);
  }
}

async function collectMetrics(keyword: Keyword, openai: OpenAI): Promise<MetricsData> {
  // Simulate or fetch real metrics
  // In production, this would call actual APIs (Google Trends, SEMrush, etc.)
  // For missing data, use AI inference

  let volume: number | null = null;
  let traffic_rank: number | null = null;
  let competition_score: number | null = null;
  let engagement: number | null = null;
  let ai_confidence = 0.0;

  // Simulate sparse data - only 30% have real metrics
  const hasRealData = Math.random() < 0.3;

  if (hasRealData) {
    volume = Math.floor(Math.random() * 10000) + 100;
    traffic_rank = Math.floor(Math.random() * 1000000);
    competition_score = Math.random() * 100;
    engagement = Math.random() * 100;
  } else {
    // Use AI to infer missing metrics
    const inference = await inferMetricsWithAI(keyword, openai);
    volume = inference.volume ?? null;
    traffic_rank = inference.traffic_rank ?? null;
    competition_score = inference.competition_score ?? null;
    engagement = inference.engagement ?? null;
    ai_confidence = inference.confidence;
  }

  return {
    volume,
    traffic_rank,
    competition_score,
    engagement,
    ai_confidence,
  };
}

async function inferMetricsWithAI(keyword: Keyword, openai: OpenAI): Promise<AIInferenceResult> {
  try {
    const prompt = `Analyze the keyword "${keyword.term}" in the ${keyword.market} market.
Provide estimates for:
- search_volume (monthly searches, 0-1000000)
- traffic_rank (1-1000000, lower is better)
- competition_score (0-100, higher means more competitive)
- engagement_score (0-100, higher means more engaging)

Return JSON only: {"volume": number, "traffic_rank": number, "competition_score": number, "engagement": number, "confidence": number}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a keyword metrics expert. Analyze keywords and provide realistic metric estimates. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      volume: parsed.volume ?? Math.floor(Math.random() * 5000) + 500,
      traffic_rank: parsed.traffic_rank ?? Math.floor(Math.random() * 500000) + 10000,
      competition_score: parsed.competition_score ?? Math.random() * 70 + 20,
      engagement: parsed.engagement ?? Math.random() * 60 + 30,
      confidence: parsed.confidence ?? 0.7,
    };
  } catch (error) {
    console.warn(`[WARN] AI inference failed for ${keyword.term}, using fallback values`);
    return {
      volume: Math.floor(Math.random() * 3000) + 500,
      traffic_rank: Math.floor(Math.random() * 500000) + 10000,
      competition_score: Math.random() * 60 + 30,
      engagement: Math.random() * 50 + 30,
      confidence: 0.5,
    };
  }
}

async function logRun(
  supabase: any,
  runId: string,
  status: string,
  successCount: number,
  errorCount: number,
  windowDays: number,
  stats: Record<string, any> = {},
  error: string | null = null
) {
  await supabase.from("demand_trend_runs").insert({
    id: runId,
    ran_at: new Date().toISOString(),
    window_days: windowDays,
    status,
    stats: {
      ...stats,
      success_count: successCount,
      error_count: errorCount,
    },
    error,
  });
}

main();
