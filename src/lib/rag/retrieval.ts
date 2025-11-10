/**
 * Ask LexyBrain RAG - Retrieval
 *
 * Handles vector search and context retrieval
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";
import { logger } from "@/lib/logger";
import type { RetrievalContext } from "./types";

const KEYWORD_EMBEDDING_DIMENSION = 384; // all-MiniLM-L6-v2

// =====================================================
// Embedding Generation
// =====================================================

/**
 * Generate embedding for RAG query
 *
 * CRITICAL: Must use the same embedding model as corpus ingestion
 * (sentence-transformers/all-MiniLM-L6-v2) for proper vector similarity.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use semantic embeddings to match corpus data
    const embedding = await createSemanticEmbedding(text, {
      fallbackToDeterministic: true,
    });

    logger.debug(
      {
        type: 'rag_embedding_generated',
        text_length: text.length,
        dimension: embedding.length,
      },
      'Generated semantic embedding for query'
    );

    return embedding;
  } catch (error) {
    logger.error(
      {
        type: 'rag_embedding_error',
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to generate embedding for RAG query'
    );
    throw error;
  }
}

// =====================================================
// Vector Search
// =====================================================

/**
 * Retrieve context using vector similarity search
 *
 * UNIFIED: Now uses ai_corpus_rrf_search (same RPC as orchestrator)
 */
export async function retrieveContext(params: {
  query: string;
  userId: string;
  capability: string;
  market?: string | null;
  timeRangeFrom?: string | null;
  timeRangeTo?: string | null;
  topK?: number;
}): Promise<RetrievalContext[]> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn('Supabase client unavailable, skipping retrieval');
    return [];
  }

  const startTime = Date.now();

  // Generate embedding
  const embedding = await generateEmbedding(params.query);

  // Call unified RPC function (same as orchestrator)
  const { data, error } = await supabase.rpc('ai_corpus_rrf_search', {
    p_query: params.query || null,
    p_query_embedding: embedding,
    p_capability: params.capability,
    p_marketplace: params.market || null,
    p_language: null,
    p_limit: params.topK || 40,
  });

  const latency = Date.now() - startTime;

  if (error) {
    logger.error(
      {
        type: 'rag_retrieval_error',
        user_id: params.userId,
        capability: params.capability,
        error: error.message,
        latency_ms: latency,
      },
      'Vector search failed'
    );
    return [];
  }

  // Transform ai_corpus results to RetrievalContext format
  const results: RetrievalContext[] = (data || []).map((row: any) => ({
    source_id: row.id,
    source_type: row.source_type,
    source_label: row.chunk?.substring(0, 100) || 'Untitled',
    chunk: row.chunk,
    similarity_score: row.combined_score || 0,
    owner_scope: row.owner_scope,
    metadata: row.metadata || {},
  }));

  logger.info(
    {
      type: 'rag_retrieval_success',
      user_id: params.userId,
      capability: params.capability,
      results_count: results.length,
      latency_ms: latency,
    },
    'Vector search completed with unified RPC'
  );

  return results;
}

// =====================================================
// Reranking
// =====================================================

/**
 * Rerank results to prioritize user-owned sources
 */
export function rerank(
  results: RetrievalContext[],
  topN: number = 12
): RetrievalContext[] {
  // Sort by ownership scope and similarity
  const ranked = results.sort((a, b) => {
    // Priority: user > global > team
    const scopePriority = { user: 3, global: 2, team: 1 };
    const aPriority = scopePriority[a.owner_scope] || 0;
    const bPriority = scopePriority[b.owner_scope] || 0;

    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    // If same scope, sort by similarity
    return b.similarity_score - a.similarity_score;
  });

  return ranked.slice(0, topN);
}

// =====================================================
// Structured Context Fetch
// =====================================================

/**
 * Fetch keyword details by IDs
 */
export async function fetchKeywordsByIds(
  keywordIds: string[]
): Promise<Array<{
  id: string;
  term: string;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  engagement_score: number | null;
  ai_opportunity_score: number | null;
}>> {
  const supabase = getSupabaseServerClient();

  if (!supabase || keywordIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('keywords')
    .select(
      'id, term, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score'
    )
    .in('id', keywordIds);

  if (error) {
    logger.error(
      { type: 'rag_keyword_fetch_error', error: error.message },
      'Failed to fetch keywords by IDs'
    );
    return [];
  }

  return data || [];
}

/**
 * Fetch full context including vector search + structured IDs
 */
export async function fetchFullContext(params: {
  query: string;
  userId: string;
  capability: string;
  market?: string | null;
  timeRangeFrom?: string | null;
  timeRangeTo?: string | null;
  keywordIds?: string[];
  topK?: number;
}): Promise<{
  vectorResults: RetrievalContext[];
  structuredKeywords: Array<{
    id: string;
    term: string;
    demand_index: number | null;
    competition_score: number | null;
    trend_momentum: number | null;
    engagement_score: number | null;
    ai_opportunity_score: number | null;
  }>;
}> {
  // Parallel fetch
  const [vectorResults, structuredKeywords] = await Promise.all([
    retrieveContext({
      query: params.query,
      userId: params.userId,
      capability: params.capability,
      market: params.market,
      timeRangeFrom: params.timeRangeFrom,
      timeRangeTo: params.timeRangeTo,
      topK: params.topK,
    }),
    params.keywordIds?.length
      ? fetchKeywordsByIds(params.keywordIds)
      : Promise.resolve([]),
  ]);

  return { vectorResults, structuredKeywords };
}
