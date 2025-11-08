/**
 * LexyBrain Training Data Logger
 *
 * Logs all LexyBrain requests, responses, and feedback to dedicated tables
 * for future fine-tuning and model improvement.
 *
 * IMPORTANT: All logging operations are async and non-blocking.
 * Failures in logging should NOT break the main inference flow.
 */

import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { LexyBrainContext } from "@/lib/lexybrain-prompt";

// =====================================================
// Types
// =====================================================

export interface LogLexyBrainRequestParams {
  userId: string | null;
  prompt: string;
  context: LexyBrainContext;
  insightType?: string;
  market?: string;
  nicheTerms?: string[];
}

export interface LogLexyBrainResponseParams {
  requestId: string;
  modelName: string;
  output: unknown;
  latencyMs: number;
  success: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

export interface LogLexyBrainFeedbackParams {
  responseId: string;
  userId: string;
  feedback: 'positive' | 'negative' | 'neutral';
  notes?: string;
}

// =====================================================
// Request Logging
// =====================================================

/**
 * Log a LexyBrain request to the database
 * Returns the request ID for linking to response
 *
 * @param params - Request parameters
 * @returns Request ID if successful, null if failed
 */
export async function logLexyBrainRequest(
  params: LogLexyBrainRequestParams
): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn(
      { type: "training_logger_no_supabase" },
      "Cannot log LexyBrain request: Supabase unavailable"
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_requests")
      .insert({
        user_id: params.userId,
        prompt: params.prompt,
        context_json: params.context,
        insight_type: params.insightType,
        market: params.market,
        niche_terms: params.nicheTerms,
        requested_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger.error(
        {
          type: "training_logger_request_failed",
          error: error.message,
          code: error.code,
        },
        "Failed to log LexyBrain request"
      );
      return null;
    }

    logger.debug(
      {
        type: "training_logger_request_logged",
        request_id: data.id,
        user_id: params.userId,
        insight_type: params.insightType,
      },
      "LexyBrain request logged successfully"
    );

    return data.id;
  } catch (error) {
    logger.error(
      {
        type: "training_logger_request_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error logging LexyBrain request"
    );
    return null;
  }
}

// =====================================================
// Response Logging
// =====================================================

/**
 * Log a LexyBrain response to the database
 * Links to the request via requestId
 *
 * @param params - Response parameters
 * @returns Response ID if successful, null if failed
 */
export async function logLexyBrainResponse(
  params: LogLexyBrainResponseParams
): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn(
      { type: "training_logger_no_supabase" },
      "Cannot log LexyBrain response: Supabase unavailable"
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_responses")
      .insert({
        request_id: params.requestId,
        model_name: params.modelName,
        output_json: params.output,
        generated_at: new Date().toISOString(),
        latency_ms: params.latencyMs,
        success: params.success,
        tokens_in: params.tokensIn,
        tokens_out: params.tokensOut,
      })
      .select("id")
      .single();

    if (error) {
      logger.error(
        {
          type: "training_logger_response_failed",
          error: error.message,
          code: error.code,
          request_id: params.requestId,
        },
        "Failed to log LexyBrain response"
      );
      return null;
    }

    logger.debug(
      {
        type: "training_logger_response_logged",
        response_id: data.id,
        request_id: params.requestId,
        latency_ms: params.latencyMs,
        success: params.success,
      },
      "LexyBrain response logged successfully"
    );

    return data.id;
  } catch (error) {
    logger.error(
      {
        type: "training_logger_response_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error logging LexyBrain response"
    );
    return null;
  }
}

// =====================================================
// Feedback Logging
// =====================================================

/**
 * Log user feedback on a LexyBrain response
 *
 * @param params - Feedback parameters
 * @returns Feedback ID if successful, null if failed
 */
export async function logLexyBrainFeedback(
  params: LogLexyBrainFeedbackParams
): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn(
      { type: "training_logger_no_supabase" },
      "Cannot log LexyBrain feedback: Supabase unavailable"
    );
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_feedback")
      .insert({
        response_id: params.responseId,
        user_id: params.userId,
        feedback: params.feedback,
        notes: params.notes,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      logger.error(
        {
          type: "training_logger_feedback_failed",
          error: error.message,
          code: error.code,
          response_id: params.responseId,
        },
        "Failed to log LexyBrain feedback"
      );
      return null;
    }

    logger.debug(
      {
        type: "training_logger_feedback_logged",
        feedback_id: data.id,
        response_id: params.responseId,
        user_id: params.userId,
        feedback: params.feedback,
      },
      "LexyBrain feedback logged successfully"
    );

    return data.id;
  } catch (error) {
    logger.error(
      {
        type: "training_logger_feedback_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error logging LexyBrain feedback"
    );
    return null;
  }
}

// =====================================================
// Combined Logging (Request + Response)
// =====================================================

/**
 * Log both request and response together
 * Returns both IDs for linking
 *
 * This is a convenience function for the common pattern of logging
 * a request and its response together.
 */
export async function logLexyBrainRequestAndResponse(
  requestParams: LogLexyBrainRequestParams,
  responseParams: Omit<LogLexyBrainResponseParams, 'requestId'>
): Promise<{
  requestId: string | null;
  responseId: string | null;
}> {
  // Log request first
  const requestId = await logLexyBrainRequest(requestParams);

  if (!requestId) {
    logger.warn(
      { type: "training_logger_request_failed_skip_response" },
      "Request logging failed, skipping response logging"
    );
    return { requestId: null, responseId: null };
  }

  // Log response
  const responseId = await logLexyBrainResponse({
    ...responseParams,
    requestId,
  });

  return { requestId, responseId };
}

// =====================================================
// Batch Operations (for efficiency)
// =====================================================

/**
 * Log multiple requests in a single batch operation
 * More efficient for bulk operations
 */
export async function logLexyBrainRequestsBatch(
  requests: LogLexyBrainRequestParams[]
): Promise<string[]> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn(
      { type: "training_logger_no_supabase" },
      "Cannot log LexyBrain requests batch: Supabase unavailable"
    );
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_requests")
      .insert(
        requests.map((params) => ({
          user_id: params.userId,
          prompt: params.prompt,
          context_json: params.context,
          insight_type: params.insightType,
          market: params.market,
          niche_terms: params.nicheTerms,
          requested_at: new Date().toISOString(),
        }))
      )
      .select("id");

    if (error) {
      logger.error(
        {
          type: "training_logger_batch_failed",
          error: error.message,
          batch_size: requests.length,
        },
        "Failed to log LexyBrain requests batch"
      );
      return [];
    }

    logger.debug(
      {
        type: "training_logger_batch_logged",
        batch_size: data.length,
      },
      "LexyBrain requests batch logged successfully"
    );

    return data.map((row) => row.id);
  } catch (error) {
    logger.error(
      {
        type: "training_logger_batch_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error logging LexyBrain requests batch"
    );
    return [];
  }
}

// =====================================================
// Query Helpers
// =====================================================

/**
 * Get feedback statistics for a response
 * Useful for analytics and model evaluation
 */
export async function getResponseFeedbackStats(responseId: string): Promise<{
  positive: number;
  negative: number;
  neutral: number;
  total: number;
} | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_feedback")
      .select("feedback")
      .eq("response_id", responseId);

    if (error) {
      logger.error(
        {
          type: "training_logger_feedback_stats_failed",
          error: error.message,
          response_id: responseId,
        },
        "Failed to get feedback stats"
      );
      return null;
    }

    const stats = {
      positive: data.filter((f) => f.feedback === 'positive').length,
      negative: data.filter((f) => f.feedback === 'negative').length,
      neutral: data.filter((f) => f.feedback === 'neutral').length,
      total: data.length,
    };

    return stats;
  } catch (error) {
    logger.error(
      {
        type: "training_logger_feedback_stats_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error getting feedback stats"
    );
    return null;
  }
}

/**
 * Get training data export for a date range
 * Returns all requests, responses, and feedback
 */
export async function exportTrainingData(
  startDate: Date,
  endDate: Date,
  limit: number = 1000
): Promise<unknown[] | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("lexybrain_training_data")
      .select("*")
      .gte("requested_at", startDate.toISOString())
      .lte("requested_at", endDate.toISOString())
      .limit(limit);

    if (error) {
      logger.error(
        {
          type: "training_logger_export_failed",
          error: error.message,
        },
        "Failed to export training data"
      );
      return null;
    }

    logger.info(
      {
        type: "training_logger_export_success",
        rows: data.length,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      "Training data exported successfully"
    );

    return data;
  } catch (error) {
    logger.error(
      {
        type: "training_logger_export_error",
        error: error instanceof Error ? error.message : String(error),
      },
      "Unexpected error exporting training data"
    );
    return null;
  }
}
