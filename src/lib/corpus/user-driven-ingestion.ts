/**
 * User-Driven Corpus Ingestion
 *
 * Creates ai_corpus entries when users first interact with keywords
 * Ensures semantic search works for user-discovered keywords
 */

import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

interface KeywordSnapshot {
  id: string;
  term: string;
  marketplace: string | null;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  engagement_score: number | null;
  ai_opportunity_score: number | null;
  source: string;
  tier?: string | number | null;
}

/**
 * Create a factual summary chunk for a keyword
 */
function createKeywordSummaryChunk(keyword: KeywordSnapshot): string {
  const parts: string[] = [];

  parts.push(`Keyword: "${keyword.term}"`);

  if (keyword.marketplace) {
    parts.push(`Marketplace: ${keyword.marketplace}`);
  }

  parts.push(`Source: ${keyword.source}`);

  if (keyword.tier !== null && keyword.tier !== undefined) {
    parts.push(`Tier: ${keyword.tier}`);
  }

  // Add metrics if available
  const metrics: string[] = [];

  if (keyword.demand_index !== null) {
    metrics.push(`Demand Index: ${keyword.demand_index.toFixed(2)}`);
  }
  if (keyword.competition_score !== null) {
    metrics.push(`Competition: ${keyword.competition_score.toFixed(2)}`);
  }
  if (keyword.trend_momentum !== null) {
    metrics.push(`Trend Momentum: ${keyword.trend_momentum.toFixed(2)}`);
  }
  if (keyword.engagement_score !== null) {
    metrics.push(`Engagement: ${keyword.engagement_score.toFixed(2)}`);
  }
  if (keyword.ai_opportunity_score !== null) {
    metrics.push(`Opportunity Score: ${keyword.ai_opportunity_score.toFixed(2)}`);
  }

  if (metrics.length > 0) {
    parts.push(`Metrics: ${metrics.join(", ")}`);
  } else {
    parts.push("Metrics: Pending analysis");
  }

  return parts.join(". ");
}

/**
 * Check if a keyword already has corpus entries
 */
async function hasCorpusEntry(
  supabase: SupabaseClient,
  keywordId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("ai_corpus")
      .select("id")
      .eq("source_type", "keyword_summary")
      .eq("source_ref->>keyword_id", keywordId)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      logger.warn(
        { type: "corpus_check_error", keyword_id: keywordId, error: error.message },
        "Failed to check corpus entry"
      );
      return false;
    }

    return !!data;
  } catch (error) {
    logger.warn(
      { type: "corpus_check_exception", keyword_id: keywordId, error: String(error) },
      "Exception checking corpus entry"
    );
    return false;
  }
}

/**
 * Ingest a keyword into ai_corpus (user-driven)
 *
 * Called when a user first searches for or interacts with a keyword
 * Creates a summary chunk with semantic embedding
 *
 * @param supabase - Supabase client
 * @param keyword - Keyword snapshot
 * @param userId - User who triggered the ingestion (optional)
 * @returns Success status
 */
export async function ingestKeywordToCorpus(
  supabase: SupabaseClient,
  keyword: KeywordSnapshot,
  userId?: string | null
): Promise<{ success: boolean; corpusId?: string; error?: string }> {
  try {
    // Check if already ingested
    const exists = await hasCorpusEntry(supabase, keyword.id);
    if (exists) {
      logger.debug(
        { type: "corpus_already_exists", keyword_id: keyword.id, term: keyword.term },
        "Keyword already in corpus, skipping"
      );
      return { success: true };
    }

    // Create summary chunk
    const chunk = createKeywordSummaryChunk(keyword);

    // Generate semantic embedding
    const embedding = await createSemanticEmbedding(chunk, {
      fallbackToDeterministic: true,
    });

    // Upsert to ai_corpus
    const corpusId = crypto.randomUUID();

    const { error: upsertError } = await supabase.from("ai_corpus").insert({
      id: corpusId,
      owner_scope: userId ? "user" : "global",
      owner_user_id: userId || null,
      owner_team_id: null,
      source_type: "keyword_summary",
      source_ref: {
        keyword_id: keyword.id,
        ingested_at: new Date().toISOString(),
        ingestion_trigger: "user_search",
      },
      marketplace: keyword.marketplace,
      language: "en",
      chunk,
      embedding: JSON.stringify(embedding),
      metadata: {
        keyword_term: keyword.term,
        source: keyword.source,
        tier: keyword.tier,
        demand_index: keyword.demand_index,
        competition_score: keyword.competition_score,
        trend_momentum: keyword.trend_momentum,
        ai_opportunity_score: keyword.ai_opportunity_score,
      },
      is_active: true,
    });

    if (upsertError) {
      logger.error(
        {
          type: "corpus_ingestion_error",
          keyword_id: keyword.id,
          term: keyword.term,
          error: upsertError.message,
        },
        "Failed to ingest keyword to corpus"
      );
      return { success: false, error: upsertError.message };
    }

    logger.info(
      {
        type: "corpus_ingestion_success",
        keyword_id: keyword.id,
        term: keyword.term,
        corpus_id: corpusId,
        user_id: userId,
      },
      "Keyword ingested to corpus"
    );

    return { success: true, corpusId };
  } catch (error) {
    logger.error(
      {
        type: "corpus_ingestion_exception",
        keyword_id: keyword.id,
        term: keyword.term,
        error: error instanceof Error ? error.message : String(error),
      },
      "Exception during keyword corpus ingestion"
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch ingest multiple keywords to corpus
 *
 * @param supabase - Supabase client
 * @param keywords - Array of keyword snapshots
 * @param userId - User who triggered the ingestion (optional)
 * @returns Results for each keyword
 */
export async function batchIngestKeywordsToCorpus(
  supabase: SupabaseClient,
  keywords: KeywordSnapshot[],
  userId?: string | null
): Promise<Array<{ keywordId: string; success: boolean; error?: string }>> {
  const results: Array<{ keywordId: string; success: boolean; error?: string }> = [];

  for (const keyword of keywords) {
    const result = await ingestKeywordToCorpus(supabase, keyword, userId);
    results.push({
      keywordId: keyword.id,
      success: result.success,
      error: result.error,
    });

    // Small delay to avoid overwhelming the embedding service
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
