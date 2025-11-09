/**
 * Ask LexyBrain RAG - Training Data Collector
 *
 * Collects conversation data for model fine-tuning
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import type { RetrievalContext } from "./types";

// =====================================================
// Training Eligibility
// =====================================================

/**
 * Check if user has opted into training data collection
 *
 * NOTE: This is a placeholder. In production, check user preferences
 * or plan settings to determine training eligibility.
 */
export async function checkTrainingEligibility(userId: string): Promise<boolean> {
  // For now, default to false for privacy
  // TODO: Implement user preference check
  return false;
}

// =====================================================
// Training Data Collection
// =====================================================

/**
 * Collect training data for fine-tuning
 *
 * Logs prompts and responses to lexybrain_requests and lexybrain_responses tables
 */
export async function collectTrainingData(params: {
  userId: string;
  messageId: string;
  prompt: string;
  response: string;
  sources: RetrievalContext[];
  capability: string;
  market?: string | null;
  nicheTerms?: string[];
}): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn('Supabase unavailable, skipping training data collection');
    return;
  }

  try {
    // 1. Insert request
    const contextJson = {
      capability: params.capability,
      market: params.market,
      niche_terms: params.nicheTerms || [],
      sources: params.sources.map((s) => ({
        id: s.source_id,
        type: s.source_type,
        label: s.source_label,
        score: s.similarity_score,
      })),
    };

    const { data: request, error: requestError } = await supabase
      .from('lexybrain_requests')
      .insert({
        user_id: params.userId,
        prompt: params.prompt,
        context_json: contextJson,
        requested_at: new Date().toISOString(),
        insight_type: params.capability,
        market: params.market || 'general',
        niche_terms: params.nicheTerms || [],
      })
      .select('id')
      .single();

    if (requestError) {
      logger.error(
        { type: 'training_request_insert_error', error: requestError.message },
        'Failed to insert training request'
      );
      return;
    }

    // 2. Insert response
    const { error: responseError } = await supabase
      .from('lexybrain_responses')
      .insert({
        request_id: request.id,
        model_name: 'rag_chat',
        output_json: { answer: params.response },
        generated_at: new Date().toISOString(),
        latency_ms: 0, // Not tracked here
        success: true,
        tokens_in: Math.ceil(params.prompt.length / 4),
        tokens_out: Math.ceil(params.response.length / 4),
      });

    if (responseError) {
      logger.error(
        { type: 'training_response_insert_error', error: responseError.message },
        'Failed to insert training response'
      );
      return;
    }

    logger.debug(
      {
        type: 'training_data_collected',
        user_id: params.userId,
        message_id: params.messageId,
        request_id: request.id,
      },
      'Training data collected'
    );
  } catch (error) {
    logger.error(
      {
        type: 'training_collection_error',
        error: error instanceof Error ? error.message : String(error),
      },
      'Training data collection failed'
    );
  }
}
