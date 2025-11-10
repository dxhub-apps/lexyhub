#!/usr/bin/env node
/**
 * Prediction Ingestion to ai_corpus Job
 *
 * Reads keyword_predictions table
 * Creates factual forecast chunks and upserts into ai_corpus with embeddings
 *
 * Run: node --loader ts-node/esm jobs/ingest-predictions-to-corpus.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createSemanticEmbedding } from "../src/lib/ai/semantic-embeddings";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "50", 10);
const LOOKBACK_DAYS = parseInt(process.env.LOOKBACK_DAYS || "30", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

interface Keyword {
  id: string;
  term: string;
  marketplace: string | null;
}

interface Prediction {
  id: string;
  keyword_id: string;
  marketplace: string | null;
  horizon: string;
  metrics: Record<string, unknown>;
  created_at: string;
}

function createPredictionChunk(keyword: Keyword, prediction: Prediction): string {
  const parts: string[] = [];

  // Header
  parts.push(`Forecast for keyword: "${keyword.term}"`);

  if (prediction.marketplace) {
    parts.push(`Marketplace: ${prediction.marketplace}`);
  }

  parts.push(`Forecast Horizon: ${prediction.horizon}`);

  // Extract prediction metrics
  const metrics = prediction.metrics;
  const predictionDetails: string[] = [];

  if (metrics.forecast_trend !== undefined) {
    predictionDetails.push(`Trend Direction: ${metrics.forecast_trend}`);
  }
  if (metrics.predicted_demand !== undefined) {
    predictionDetails.push(`Predicted Demand: ${metrics.predicted_demand}`);
  }
  if (metrics.growth_rate !== undefined) {
    predictionDetails.push(`Growth Rate: ${typeof metrics.growth_rate === 'number' ? (metrics.growth_rate * 100).toFixed(1) + '%' : metrics.growth_rate}`);
  }
  if (metrics.confidence !== undefined) {
    predictionDetails.push(`Confidence: ${typeof metrics.confidence === 'number' ? (metrics.confidence * 100).toFixed(0) + '%' : metrics.confidence}`);
  }
  if (metrics.seasonality_index !== undefined) {
    predictionDetails.push(`Seasonality Index: ${metrics.seasonality_index}`);
  }
  if (metrics.volatility !== undefined) {
    predictionDetails.push(`Volatility: ${metrics.volatility}`);
  }

  if (predictionDetails.length > 0) {
    parts.push(`Prediction Metrics: ${predictionDetails.join(", ")}`);
  }

  // Add forecast context
  if (metrics.forecast_summary && typeof metrics.forecast_summary === 'string') {
    parts.push(`Summary: ${metrics.forecast_summary}`);
  }

  const createdDate = new Date(prediction.created_at).toISOString().split("T")[0];
  parts.push(`Forecast Generated: ${createdDate}`);

  return parts.join(". ");
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const runId = crypto.randomUUID();
  const runStarted = new Date().toISOString();

  console.log(`[${runStarted}] Starting prediction ingestion to ai_corpus ${runId}`);
  console.log(`[INFO] Batch size: ${BATCH_SIZE}, Lookback: ${LOOKBACK_DAYS} days`);

  try {
    // Get recent predictions
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

    const { data: predictions, error: predictionsError } = await supabase
      .from("keyword_predictions")
      .select("id, keyword_id, marketplace, horizon, metrics, created_at")
      .gte("created_at", lookbackDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (predictionsError) {
      throw new Error(`Failed to fetch predictions: ${predictionsError.message}`);
    }

    if (!predictions || predictions.length === 0) {
      console.log("[INFO] No predictions found for ingestion");
      return;
    }

    console.log(`[INFO] Processing ${predictions.length} predictions`);

    // Fetch associated keywords
    const keywordIds = [...new Set(predictions.map((p) => p.keyword_id))];
    const { data: keywords, error: keywordsError } = await supabase
      .from("keywords")
      .select("id, term, marketplace")
      .in("id", keywordIds);

    if (keywordsError) {
      throw new Error(`Failed to fetch keywords: ${keywordsError.message}`);
    }

    const keywordsMap = new Map<string, Keyword>();
    (keywords || []).forEach((k) => {
      keywordsMap.set(k.id, k as Keyword);
    });

    // Process each prediction
    let successCount = 0;
    let errorCount = 0;

    for (const prediction of predictions as Prediction[]) {
      try {
        const keyword = keywordsMap.get(prediction.keyword_id);
        if (!keyword) {
          console.warn(`[WARN] Keyword not found for prediction ${prediction.id}`);
          errorCount++;
          continue;
        }

        // Create factual chunk
        const chunk = createPredictionChunk(keyword, prediction);

        // Generate semantic embedding
        const embedding = await createSemanticEmbedding(chunk, {
          fallbackToDeterministic: true,
        });

        // Upsert to ai_corpus
        const { error: upsertError } = await supabase
          .from("ai_corpus")
          .upsert({
            id: crypto.randomUUID(),
            owner_scope: "global",
            owner_user_id: null,
            owner_team_id: null,
            source_type: "keyword_prediction",
            source_ref: {
              prediction_id: prediction.id,
              keyword_id: prediction.keyword_id,
              horizon: prediction.horizon,
              ingested_at: new Date().toISOString(),
            },
            marketplace: prediction.marketplace || keyword.marketplace,
            language: "en",
            chunk,
            embedding: JSON.stringify(embedding),
            metadata: {
              keyword_term: keyword.term,
              horizon: prediction.horizon,
              metrics: prediction.metrics,
              created_at: prediction.created_at,
            },
            is_active: true,
          }, {
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`[ERROR] Failed to upsert prediction ${prediction.id}: ${upsertError.message}`);
          errorCount++;
        } else {
          successCount++;
          if (successCount % 10 === 0) {
            console.log(`[INFO] Processed ${successCount}/${predictions.length} predictions`);
          }
        }
      } catch (error) {
        console.error(`[ERROR] Failed to process prediction ${prediction.id}: ${error}`);
        errorCount++;
      }
    }

    const runEnded = new Date().toISOString();
    const duration = new Date(runEnded).getTime() - new Date(runStarted).getTime();

    console.log(`[${runEnded}] Prediction ingestion completed`);
    console.log(`[INFO] Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`[INFO] Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error(`[ERROR] Fatal error in prediction ingestion: ${error}`);
    process.exit(1);
  }
}

main();
