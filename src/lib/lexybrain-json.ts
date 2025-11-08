/**
 * LexyBrain JSON Generation Wrapper
 *
 * High-level interface for generating validated JSON outputs from LexyBrain.
 * Combines prompt building, LLM calls, parsing, and validation.
 *
 * MIGRATION NOTE: Now uses RunPod Serverless Queue via runpodClient
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "./logger";
import { getSupabaseServerClient } from "./supabase-server";
import {
  callLexyBrainRunpod,
  type LexyBrainRequest,
} from "./lexybrain/runpodClient";
import { RunPodClientError, RunPodTimeoutError } from "./lexybrain/errors";
import { extractJsonFromOutput } from "./lexybrain/utils";
import {
  buildLexyBrainPrompt,
  type LexyBrainContext,
  type PromptConfig,
} from "./lexybrain-prompt";
import {
  validateLexyBrainOutput,
  type LexyBrainOutput,
  type LexyBrainOutputType,
} from "./lexybrain-schemas";
import { getLexyBrainModelVersion } from "./lexybrain-config";
import {
  logLexyBrainRequest,
  logLexyBrainResponse,
} from "./lexybrain/trainingLogger";

// =====================================================
// Types
// =====================================================

export interface GenerateLexyBrainJsonParams {
  type: LexyBrainOutputType;
  context: LexyBrainContext;
  userId: string;
  promptConfig?: PromptConfig;
  maxRetries?: number;
}

export interface GenerateLexyBrainJsonResult {
  output: LexyBrainOutput;
  metadata: {
    latencyMs: number;
    promptTokens: number;
    outputTokens: number;
    modelVersion: string;
    retryCount: number;
    requestId?: string | null; // For training data tracking
    responseId?: string | null; // For training data tracking
  };
}

export class LexyBrainValidationError extends Error {
  constructor(
    message: string,
    public rawOutput: string,
    public validationErrors: string[]
  ) {
    super(message);
    this.name = "LexyBrainValidationError";
  }
}

// =====================================================
// Main Generation Function
// =====================================================

/**
 * Generate validated JSON output from LexyBrain
 *
 * Steps:
 * 1. Build prompt
 * 2. Call LLM
 * 3. Parse JSON
 * 4. Validate against schema
 * 5. Retry once on failure with stricter instructions
 * 6. Log failure and throw on second failure
 */
export async function generateLexyBrainJson(
  params: GenerateLexyBrainJsonParams
): Promise<GenerateLexyBrainJsonResult> {
  const { type, context, userId, promptConfig, maxRetries = 1 } = params;

  const startTime = Date.now();
  let retryCount = 0;
  let lastError: Error | null = null;
  let rawOutput: string | null = null;
  let trainingRequestId: string | null = null;

  // Attempt generation with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Build prompt
      const isRetry = attempt > 0;
      const prompt = buildPromptForAttempt(
        type,
        context,
        promptConfig,
        isRetry
      );

      // Rough token estimation (4 chars per token)
      const promptTokens = Math.ceil(prompt.length / 4);

      logger.debug(
        {
          type: "lexybrain_generate",
          insight_type: type,
          user_id: userId,
          attempt: attempt + 1,
          is_retry: isRetry,
          prompt_tokens: promptTokens,
        },
        "Generating LexyBrain JSON"
      );

      // Log request to training data (async, non-blocking)
      // Only log on first attempt to avoid duplicate training data
      if (attempt === 0) {
        logLexyBrainRequest({
          userId,
          prompt,
          context,
          insightType: type,
          market: context.market,
          nicheTerms: context.niche_terms,
        }).then((requestId) => {
          trainingRequestId = requestId;
        }).catch((err) => {
          logger.warn(
            {
              type: "training_logger_request_async_failed",
              error: err instanceof Error ? err.message : String(err),
            },
            "Failed to log training request (non-blocking)"
          );
        });
      }

      // Call LLM via RunPod Serverless Queue
      logger.debug(
        { type: "lexybrain_generate_call", user_id: userId },
        "Calling LexyBrain RunPod Serverless"
      );

      const response = await callLexyBrainRunpod(
        {
          prompt,
          temperature: isRetry ? 0.1 : 0.3, // More deterministic on retry
          max_tokens: 512, // Default max tokens
        },
        {
          timeoutMs: 55000, // 55 seconds (under Vercel 60s limit)
        }
      );

      rawOutput = response.completion;

      // Extract and parse JSON
      const jsonText = extractJsonFromOutput(rawOutput);

      // Debug logging to diagnose validation failures
      logger.debug(
        {
          type: "lexybrain_json_extraction",
          insight_type: type,
          user_id: userId,
          raw_output_preview: rawOutput.substring(0, 500),
          raw_output_length: rawOutput.length,
          extracted_json_preview: jsonText.substring(0, 500),
          extracted_json_length: jsonText.length,
        },
        "Extracted JSON from model output"
      );

      const parsedData = JSON.parse(jsonText);

      logger.debug(
        {
          type: "lexybrain_json_parsed",
          insight_type: type,
          user_id: userId,
          parsed_keys: Object.keys(parsedData),
          parsed_data_preview: JSON.stringify(parsedData).substring(0, 500),
        },
        "Parsed JSON data"
      );

      // Validate against schema
      const validatedOutput = validateLexyBrainOutput(type, parsedData);

      // Calculate metrics
      const latencyMs = Date.now() - startTime;
      const outputTokens = Math.ceil(rawOutput.length / 4);

      logger.info(
        {
          type: "lexybrain_generate_success",
          insight_type: type,
          user_id: userId,
          latency_ms: latencyMs,
          prompt_tokens: promptTokens,
          output_tokens: outputTokens,
          retry_count: retryCount,
        },
        "LexyBrain JSON generation successful"
      );

      // Log response to training data (async, non-blocking)
      let trainingResponseId: string | null = null;
      if (trainingRequestId) {
        logLexyBrainResponse({
          requestId: trainingRequestId,
          modelName: getLexyBrainModelVersion(),
          output: validatedOutput,
          latencyMs,
          success: true,
          tokensIn: promptTokens,
          tokensOut: outputTokens,
        }).then((responseId) => {
          trainingResponseId = responseId;
        }).catch((err) => {
          logger.warn(
            {
              type: "training_logger_response_async_failed",
              error: err instanceof Error ? err.message : String(err),
            },
            "Failed to log training response (non-blocking)"
          );
        });
      }

      return {
        output: validatedOutput,
        metadata: {
          latencyMs,
          promptTokens,
          outputTokens,
          modelVersion: getLexyBrainModelVersion(),
          retryCount,
          requestId: trainingRequestId,
          responseId: trainingResponseId,
        },
      };
    } catch (error) {
      retryCount = attempt;
      lastError = error as Error;

      logger.warn(
        {
          type: "lexybrain_generate_attempt_failed",
          insight_type: type,
          user_id: userId,
          attempt: attempt + 1,
          max_attempts: maxRetries + 1,
          error: error instanceof Error ? error.message : String(error),
        },
        "LexyBrain generation attempt failed"
      );

      // Don't retry on timeout errors - they take too long and will hit Vercel's limit
      // Only retry on parsing/validation errors which might be model output issues
      if (error instanceof RunPodTimeoutError) {
        logger.warn(
          {
            type: "lexybrain_timeout_no_retry",
            insight_type: type,
            user_id: userId,
            timeout_ms: error.timeoutMs,
          },
          "Not retrying on timeout error to avoid Vercel timeout"
        );
        break;
      }

      // If this is not the last attempt, continue to retry
      if (attempt < maxRetries) {
        continue;
      }

      // Last attempt failed - log and throw
      break;
    }
  }

  // All attempts failed - record failure and throw
  const latencyMs = Date.now() - startTime;

  await recordAiFailure(userId, type, lastError!, rawOutput);

  logger.error(
    {
      type: "lexybrain_generate_failed",
      insight_type: type,
      user_id: userId,
      latency_ms: latencyMs,
      retry_count: retryCount,
      error: lastError instanceof Error ? lastError.message : String(lastError),
    },
    "LexyBrain JSON generation failed after all retries"
  );

  // Capture in Sentry
  Sentry.captureException(lastError, {
    tags: {
      feature: "lexybrain",
      component: "json-generator",
      insight_type: type,
    },
    extra: {
      user_id: userId,
      retry_count: retryCount,
      raw_output: rawOutput?.substring(0, 1000), // First 1000 chars
      latency_ms: latencyMs,
    },
  });

  // Throw appropriate error
  if (lastError instanceof LexyBrainClientError || lastError instanceof RunPodClientError) {
    throw lastError;
  } else if (lastError instanceof LexyBrainTimeoutError || lastError instanceof RunPodTimeoutError) {
    throw lastError;
  } else if (lastError instanceof SyntaxError) {
    throw new LexyBrainValidationError(
      `Failed to parse LexyBrain output as JSON: ${lastError.message}`,
      rawOutput || "",
      [`JSON parsing error: ${lastError.message}`]
    );
  } else {
    throw new LexyBrainValidationError(
      `Failed to validate LexyBrain output: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      rawOutput || "",
      [lastError instanceof Error ? lastError.message : String(lastError)]
    );
  }
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Build prompt with optional retry-specific enhancements
 */
function buildPromptForAttempt(
  type: LexyBrainOutputType,
  context: LexyBrainContext,
  promptConfig: PromptConfig | undefined,
  isRetry: boolean
): string {
  let config = promptConfig;

  // On retry, add stricter instructions
  if (isRetry && config) {
    config = {
      ...config,
      system_instructions:
        config.system_instructions +
        "\n\nIMPORTANT: The previous attempt failed validation. Ensure you return ONLY valid JSON with no additional text, markdown, or code fences. Follow the exact schema provided.",
    };
  } else if (isRetry) {
    config = {
      system_instructions:
        "You are LexyBrain. Return ONLY valid JSON with no markdown or code fences. Follow the exact schema.",
      constraints: {},
    };
  }

  return buildLexyBrainPrompt(type, context, config);
}

/**
 * Record AI failure in database for analysis
 */
async function recordAiFailure(
  userId: string,
  type: LexyBrainOutputType,
  error: Error,
  rawOutput: string | null
): Promise<void> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn("Cannot record AI failure: Supabase client unavailable");
    return;
  }

  try {
    await supabase.from("ai_failures").insert({
      user_id: userId,
      type,
      error_code: error.name,
      error_message: error.message,
      payload: {
        error_type: error.constructor.name,
        error_message: error.message,
        raw_output: rawOutput?.substring(0, 5000), // First 5000 chars
        stack: error.stack,
      },
      ts: new Date().toISOString(),
    });

    logger.debug(
      { type: "ai_failure_recorded", insight_type: type, user_id: userId },
      "AI failure recorded in database"
    );
  } catch (dbError) {
    logger.error(
      {
        type: "ai_failure_recording_failed",
        error:
          dbError instanceof Error ? dbError.message : String(dbError),
      },
      "Failed to record AI failure in database"
    );
  }
}

// =====================================================
// Batch Generation (Future Enhancement)
// =====================================================

/**
 * Generate multiple insights in parallel
 * Useful for dashboard loading
 */
export async function generateLexyBrainJsonBatch(
  requests: GenerateLexyBrainJsonParams[]
): Promise<Array<GenerateLexyBrainJsonResult | { error: string }>> {
  const results = await Promise.allSettled(
    requests.map((params) => generateLexyBrainJson(params))
  );

  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      return {
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    }
  });
}
