/**
 * Shared job logic for corpus ingestion
 * Extracts the core logic so it can be called directly without HTTP requests
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";

const BATCH_SIZE = 50;
const LOOKBACK_DAYS = 7;

interface Keyword {
  id: string;
  term: string;
  market: string | null;
  marketplace?: string | null;
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

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}


function createMetricChunk(keyword: Keyword, dailyMetrics: DailyMetric[], weeklyMetrics: WeeklyMetric[]): string {
  const parts: string[] = [];

  parts.push(`Keyword: "${keyword.term}"`);
  if (keyword.market) {
    parts.push(`Marketplace: ${keyword.market}`);
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

/**
 * Ingest keyword metrics to ai_corpus
 */
export async function ingestMetricsToCorpus(): Promise<{ success: boolean; processed: number; successCount: number; errorCount: number; error?: string }> {
  console.log("[ingestMetricsToCorpus] Starting keyword metrics ingestion...");
  try {
    const supabase = getSupabaseClient();

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);
    console.log(`[ingestMetricsToCorpus] Lookback date: ${lookbackDate.toISOString()}, Batch size: ${BATCH_SIZE}`);

    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, term, market, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score")
      .not("market", "is", null)
      .gte("updated_at", lookbackDate.toISOString())
      .order("updated_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (keywordsError) {
      console.error("[ingestMetricsToCorpus] Failed to fetch keywords:", keywordsError);
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    if (!keywords || keywords.length === 0) {
      console.log("[ingestMetricsToCorpus] No keywords found to process");
      return { success: true, processed: 0, successCount: 0, errorCount: 0 };
    }

    console.log(`[ingestMetricsToCorpus] Found ${keywords.length} keywords to process`);

    const keywordIds = keywords.map((k) => k.id);

    // Fetch metrics
    console.log(`[ingestMetricsToCorpus] Fetching daily and weekly metrics for ${keywordIds.length} keywords...`);
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

    console.log(
      `[ingestMetricsToCorpus] Found ${dailyMetrics?.length || 0} daily metrics, ${weeklyMetrics?.length || 0} weekly metrics`,
    );

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

    console.log(`[ingestMetricsToCorpus] Processing ${keywords.length} keywords...`);
    for (const keyword of keywords as Keyword[]) {
      try {
        const daily = dailyByKeyword.get(keyword.id) || [];
        const weekly = weeklyByKeyword.get(keyword.id) || [];

        console.log(
          `[ingestMetricsToCorpus] Processing keyword "${keyword.term}" (${keyword.id}): ${daily.length} daily, ${weekly.length} weekly metrics`,
        );

        const chunk = createMetricChunk(keyword, daily, weekly);
        console.log(
          `[ingestMetricsToCorpus] Created chunk for "${keyword.term}" (${chunk.length} chars)`,
        );

        const embedding = await createSemanticEmbedding(chunk);
        console.log(
          `[ingestMetricsToCorpus] Generated embedding for "${keyword.term}" (${embedding.length} dimensions)`,
        );

        // Validate embedding dimension
        if (embedding.length !== 384) {
          console.error(
            `[ERROR] Invalid embedding dimension for keyword ${keyword.id} "${keyword.term}": expected 384, got ${embedding.length}`,
          );
          errorCount++;
          continue;
        }

        const { error: upsertError } = await supabase.from("ai_corpus").upsert(
          {
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
            marketplace: keyword.market,
            language: "en",
            chunk,
            embedding: embedding,
            metadata: {
              keyword_term: keyword.term,
              demand_index: keyword.demand_index,
              competition_score: keyword.competition_score,
              trend_momentum: keyword.trend_momentum,
              ai_opportunity_score: keyword.ai_opportunity_score,
            },
            is_active: true,
          },
          { onConflict: "id", ignoreDuplicates: false },
        );

        if (upsertError) {
          console.error(
            `[ERROR] Failed to upsert keyword_metrics for keyword ${keyword.id} "${keyword.term}":`,
            {
              keyword_id: keyword.id,
              keyword_term: keyword.term,
              error_code: upsertError.code,
              error_message: upsertError.message,
              error_details: upsertError.details,
              error_hint: upsertError.hint,
              embedding_length: embedding.length,
              chunk_length: chunk.length,
              marketplace: keyword.market,
            },
          );
          errorCount++;
        } else {
          successCount++;
          console.log(
            `[ingestMetricsToCorpus] ✓ Successfully inserted keyword "${keyword.term}" (${successCount}/${keywords.length})`,
          );
        }
      } catch (error) {
        console.error(
          `[ERROR] Exception during keyword_metrics ingestion for keyword ${keyword.id} "${keyword.term}":`,
          error,
        );
        errorCount++;
      }
    }

    console.log(
      `[ingestMetricsToCorpus] Completed: ${successCount} success, ${errorCount} errors out of ${keywords.length} total`,
    );

    return {
      success: true,
      processed: keywords.length,
      successCount,
      errorCount,
    };
  } catch (error) {
    console.error("[ingestMetricsToCorpus] Fatal error:", error);
    return {
      success: false,
      processed: 0,
      successCount: 0,
      errorCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ingest keyword predictions to ai_corpus
 */
export async function ingestPredictionsToCorpus(): Promise<{ success: boolean; processed: number; successCount: number; error?: string }> {
  console.log("[ingestPredictionsToCorpus] Starting keyword predictions ingestion...");
  try {
    const supabase = getSupabaseClient();

    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    console.log(
      `[ingestPredictionsToCorpus] Lookback date: ${lookbackDate.toISOString()}, Limit: 50`,
    );

    const { data: predictions, error } = await supabase
      .from("keyword_predictions")
      .select("id, keyword_id, marketplace, horizon, metrics, created_at")
      .gte("created_at", lookbackDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[ingestPredictionsToCorpus] Failed to fetch predictions:", error);
      return { success: true, processed: 0, successCount: 0 };
    }

    if (!predictions?.length) {
      console.log("[ingestPredictionsToCorpus] No predictions found to process");
      return { success: true, processed: 0, successCount: 0 };
    }

    console.log(
      `[ingestPredictionsToCorpus] Found ${predictions.length} predictions to process`,
    );

    const keywordIds = [...new Set(predictions.map((p) => p.keyword_id))];
    console.log(
      `[ingestPredictionsToCorpus] Fetching ${keywordIds.length} unique keywords...`,
    );
    const { data: keywords } = await supabase
      .from("keywords")
      .select("id, term, market")
      .in("id", keywordIds);

    const keywordsMap = new Map((keywords || []).map((k) => [k.id, k]));
    console.log(
      `[ingestPredictionsToCorpus] Found ${keywordsMap.size} keywords`,
    );

    let successCount = 0;
    let errorCount = 0;

    console.log(
      `[ingestPredictionsToCorpus] Processing ${predictions.length} predictions...`,
    );
    for (const pred of predictions) {
      const keyword = keywordsMap.get(pred.keyword_id);
      if (!keyword) {
        console.warn(
          `[ingestPredictionsToCorpus] Keyword not found for prediction ${pred.id}, skipping`,
        );
        errorCount++;
        continue;
      }

      console.log(
        `[ingestPredictionsToCorpus] Processing prediction for "${keyword.term}" (${pred.horizon})`,
      );

      const chunk = `Forecast for keyword: "${keyword.term}". Marketplace: ${
        pred.marketplace || keyword.market
      }. Forecast Horizon: ${pred.horizon}. ${JSON.stringify(
        pred.metrics,
      )}`;
      console.log(
        `[ingestPredictionsToCorpus] Created chunk (${chunk.length} chars)`,
      );

      const embedding = await createSemanticEmbedding(chunk);
      console.log(
        `[ingestPredictionsToCorpus] Generated embedding (${embedding.length} dimensions)`,
      );

      // Validate embedding dimension
      if (embedding.length !== 384) {
        console.error(
          `[ERROR] Invalid embedding dimension for prediction ${pred.id} "${keyword.term}": expected 384, got ${embedding.length}`,
        );
        errorCount++;
        continue;
      }

      const { error: upsertError } = await supabase.from("ai_corpus").upsert({
        id: crypto.randomUUID(),
        owner_scope: "global",
        owner_user_id: null,
        owner_team_id: null,
        source_type: "keyword_prediction",
        source_ref: {
          prediction_id: pred.id,
          keyword_id: pred.keyword_id,
          ingested_at: new Date().toISOString(),
        },
        marketplace: pred.marketplace || keyword.market,
        language: "en",
        chunk,
        embedding: embedding,
        metadata: {
          keyword_term: keyword.term,
          horizon: pred.horizon,
          metrics: pred.metrics,
        },
        is_active: true,
      });

      if (upsertError) {
        console.error(
          `[ERROR] Failed to upsert keyword_prediction for prediction ${pred.id} "${keyword.term}":`,
          {
            prediction_id: pred.id,
            keyword_id: pred.keyword_id,
            keyword_term: keyword.term,
            error_code: upsertError.code,
            error_message: upsertError.message,
            error_details: upsertError.details,
            error_hint: upsertError.hint,
            embedding_length: embedding.length,
            chunk_length: chunk.length,
          },
        );
        errorCount++;
      } else {
        successCount++;
        console.log(
          `[ingestPredictionsToCorpus] ✓ Successfully inserted prediction for "${keyword.term}" (${successCount}/${predictions.length})`,
        );
      }
    }

    console.log(
      `[ingestPredictionsToCorpus] Completed: ${successCount} success, ${errorCount} errors out of ${predictions.length} total`,
    );

    return { success: true, processed: predictions.length, successCount };
  } catch (error) {
    console.error("[ingestPredictionsToCorpus] Fatal error:", error);
    return {
      success: false,
      processed: 0,
      successCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Ingest risk rules and events to ai_corpus
 */
export async function ingestRisksToCorpus(): Promise<{ success: boolean; totalSuccess: number; error?: string }> {
  console.log("[ingestRisksToCorpus] Starting risks ingestion...");
  try {
    const supabase = getSupabaseClient();
    let totalSuccess = 0;
    let totalErrors = 0;

    // Ingest risk rules
    console.log("[ingestRisksToCorpus] Fetching risk rules...");
    const { data: rules } = await supabase
      .from("risk_rules")
      .select("id, rule_code, description, marketplace, severity, metadata");

    if (rules) {
      console.log(
        `[ingestRisksToCorpus] Found ${rules.length} risk rules to process`,
      );
      for (const rule of rules) {
        console.log(
          `[ingestRisksToCorpus] Processing rule: ${rule.rule_code} (${rule.severity})`,
        );

        const chunk = `Risk Rule: ${rule.rule_code}. Description: ${rule.description}. Severity: ${rule.severity.toUpperCase()}. ${
          rule.marketplace
            ? `Marketplace: ${rule.marketplace}`
            : "Scope: All marketplaces"
        }`;
        console.log(
          `[ingestRisksToCorpus] Created chunk for rule ${rule.rule_code} (${chunk.length} chars)`,
        );

        const embedding = await createSemanticEmbedding(chunk);
        console.log(
          `[ingestRisksToCorpus] Generated embedding for rule ${rule.rule_code} (${embedding.length} dimensions)`,
        );

        // Validate embedding dimension
        if (embedding.length !== 384) {
          console.error(
            `[ERROR] Invalid embedding dimension for risk rule ${rule.id} "${rule.rule_code}": expected 384, got ${embedding.length}`,
          );
          totalErrors++;
          continue;
        }

        const { error: upsertError } = await supabase.from("ai_corpus").upsert({
          id: crypto.randomUUID(),
          owner_scope: "global",
          owner_user_id: null,
          owner_team_id: null,
          source_type: "risk_rule",
          source_ref: {
            rule_id: rule.id,
            rule_code: rule.rule_code,
            ingested_at: new Date().toISOString(),
          },
          marketplace: rule.marketplace,
          language: "en",
          chunk,
          embedding: embedding,
          metadata: {
            rule_code: rule.rule_code,
            severity: rule.severity,
            description: rule.description,
          },
          is_active: true,
        });

        if (upsertError) {
          console.error(
            `[ERROR] Failed to upsert risk_rule for rule ${rule.id} "${rule.rule_code}":`,
            {
              rule_id: rule.id,
              rule_code: rule.rule_code,
              error_code: upsertError.code,
              error_message: upsertError.message,
              error_details: upsertError.details,
              error_hint: upsertError.hint,
              embedding_length: embedding.length,
              chunk_length: chunk.length,
            },
          );
          totalErrors++;
        } else {
          totalSuccess++;
          console.log(
            `[ingestRisksToCorpus] ✓ Successfully inserted risk rule ${rule.rule_code} (${totalSuccess} total success)`,
          );
        }
      }
      console.log(
        `[ingestRisksToCorpus] Risk rules completed: ${totalSuccess} success, ${totalErrors} errors`,
      );
    } else {
      console.log("[ingestRisksToCorpus] No risk rules found");
    }

    // Ingest recent risk events
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    console.log(
      `[ingestRisksToCorpus] Fetching risk events from ${lookbackDate.toISOString()}...`,
    );

    const { data: events } = await supabase
      .from("risk_events")
      .select(
        "id, keyword_id, rule_id, marketplace, occurred_at, details, scope",
      )
      .gte("occurred_at", lookbackDate.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(100);

    if (events) {
      console.log(
        `[ingestRisksToCorpus] Found ${events.length} risk events to process`,
      );
      const keywordIds = [
        ...new Set(
          events
            .filter((e) => e.keyword_id)
            .map((e) => e.keyword_id as string),
        ),
      ];
      const ruleIds = [
        ...new Set(
          events.filter((e) => e.rule_id).map((e) => e.rule_id as string),
        ),
      ];

      console.log(
        `[ingestRisksToCorpus] Fetching ${keywordIds.length} keywords and ${ruleIds.length} rules...`,
      );
      const { data: keywords } = keywordIds.length
        ? await supabase
            .from("keywords")
            .select("id, term, market")
            .in("id", keywordIds)
        : { data: [] };
      const { data: rulesData } = ruleIds.length
        ? await supabase
            .from("risk_rules")
            .select("id, rule_code, description, severity")
            .in("id", ruleIds)
        : { data: [] };

      const keywordsMap = new Map((keywords || []).map((k) => [k.id, k]));
      const rulesMap = new Map((rulesData || []).map((r) => [r.id, r]));
      console.log(
        `[ingestRisksToCorpus] Loaded ${keywordsMap.size} keywords, ${rulesMap.size} rules`,
      );

      let eventSuccess = 0;
      let eventErrors = 0;

      for (const event of events) {
        const keyword = event.keyword_id
          ? keywordsMap.get(event.keyword_id)
          : null;
        const rule = event.rule_id ? rulesMap.get(event.rule_id) : null;

        console.log(
          `[ingestRisksToCorpus] Processing event ${event.id}${
            keyword ? ` for "${keyword.term}"` : ""
          }${rule ? ` - ${rule.rule_code}` : ""}`,
        );

        const chunk = `Risk Alert${
          keyword ? ` for keyword: "${keyword.term}"` : ""
        }. ${
          rule
            ? `Rule: ${rule.rule_code} - ${rule.description}. Severity: ${rule.severity}`
            : ""
        }. Date: ${new Date(event.occurred_at)
          .toISOString()
          .split("T")[0]}. ${JSON.stringify(event.details)}`;
        console.log(
          `[ingestRisksToCorpus] Created chunk for event ${event.id} (${chunk.length} chars)`,
        );

        const embedding = await createSemanticEmbedding(chunk);
        console.log(
          `[ingestRisksToCorpus] Generated embedding for event ${event.id} (${embedding.length} dimensions)`,
        );

        // Validate embedding dimension
        if (embedding.length !== 384) {
          console.error(
            `[ERROR] Invalid embedding dimension for risk event ${event.id}: expected 384, got ${embedding.length}`,
          );
          eventErrors++;
          continue;
        }

        // Always use global scope for risk events to avoid constraint violations
        // (user-scoped events would require owner_user_id, which is not available here)
        const { error: upsertError } = await supabase.from("ai_corpus").upsert({
          id: crypto.randomUUID(),
          owner_scope: "global",
          owner_user_id: null,
          owner_team_id: null,
          source_type: "risk_event",
          source_ref: {
            event_id: event.id,
            keyword_id: event.keyword_id,
            rule_id: event.rule_id,
            ingested_at: new Date().toISOString(),
          },
          marketplace: event.marketplace || keyword?.market,
          language: "en",
          chunk,
          embedding: embedding,
          metadata: {
            keyword_term: keyword?.term,
            rule_code: rule?.rule_code,
            severity: rule?.severity,
            occurred_at: event.occurred_at,
            scope: event.scope,
          },
          is_active: true,
        });

        if (upsertError) {
          console.error(
            `[ERROR] Failed to upsert risk_event for event ${event.id}:`,
            {
              event_id: event.id,
              keyword_id: event.keyword_id,
              rule_id: event.rule_id,
              error_code: upsertError.code,
              error_message: upsertError.message,
              error_details: upsertError.details,
              error_hint: upsertError.hint,
              embedding_length: embedding.length,
              chunk_length: chunk.length,
            },
          );
          eventErrors++;
        } else {
          eventSuccess++;
          totalSuccess++;
          console.log(
            `[ingestRisksToCorpus] ✓ Successfully inserted risk event ${event.id} (${eventSuccess}/${events.length})`,
          );
        }
      }
      console.log(
        `[ingestRisksToCorpus] Risk events completed: ${eventSuccess} success, ${eventErrors} errors`,
      );
    } else {
      console.log("[ingestRisksToCorpus] No risk events found");
    }

    console.log(
      `[ingestRisksToCorpus] Overall completed: ${totalSuccess} total success, ${totalErrors} total errors`,
    );

    return { success: true, totalSuccess };
  } catch (error) {
    console.error("[ingestRisksToCorpus] Fatal error:", error);
    return {
      success: false,
      totalSuccess: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
