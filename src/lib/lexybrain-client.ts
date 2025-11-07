/**
 * LexyBrain Client - HTTP llama.cpp Server Communication
 *
 * Handles direct communication with the RunPod-hosted llama.cpp HTTP server.
 *
 * ARCHITECTURE:
 * - LexyBrain is deployed as a load balancing RunPod Serverless endpoint
 * - Base URL format: https://<endpoint-id>.api.runpod.ai
 * - Authentication: REQUIRED "Authorization: Bearer <RUNPOD_API_KEY>" header
 *   (validated by RunPod load balancer before traffic reaches worker)
 * - Optional: X-LEXYBRAIN-KEY header (only enforced if configured in container)
 * - Endpoint: /completion (llama.cpp HTTP server)
 *
 * DO NOT use:
 * - api.runpod.ai/v2/... URLs (those are for job-based APIs)
 * - /run, /runsync, /status endpoints (not part of llama.cpp HTTP server)
 */

import * as Sentry from "@sentry/nextjs";
import {
  isLexyBrainEnabled,
  getLexyBrainModelUrl,
  getLexyBrainKey,
  getLexyBrainModelVersion,
  getLexyBrainSloConfig,
} from "./lexybrain-config";
import { logger } from "./logger";

// =====================================================
// Types
// =====================================================

/**
 * llama.cpp HTTP server completion request
 * See: https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md
 */
export interface LlamaCppCompletionRequest {
  prompt: string;
  n_predict?: number; // max tokens to generate
  temperature?: number;
  top_p?: number;
  stop?: string[];
  stream?: boolean;
}

/**
 * llama.cpp HTTP server completion response
 */
export interface LlamaCppCompletionResponse {
  content?: string; // Main response field
  generated_text?: string; // Alternative field
  stop?: boolean;
  model?: string;
  tokens_predicted?: number;
  tokens_evaluated?: number;
  generation_settings?: {
    n_ctx?: number;
    model?: string;
    seed?: number;
    temperature?: number;
    top_p?: number;
  };
  prompt?: string;
  truncated?: boolean;
  stopped_eos?: boolean;
  stopped_word?: boolean;
  stopped_limit?: boolean;
  stopping_word?: string;
  timings?: {
    prompt_n?: number;
    prompt_ms?: number;
    prompt_per_token_ms?: number;
    prompt_per_second?: number;
    predicted_n?: number;
    predicted_ms?: number;
    predicted_per_token_ms?: number;
    predicted_per_second?: number;
  };
}

export class LexyBrainClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = "LexyBrainClientError";
  }
}

export class LexyBrainTimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = "LexyBrainTimeoutError";
  }
}

// =====================================================
// Core Client Function
// =====================================================

/**
 * Call the LexyBrain llama.cpp HTTP server with a prompt
 * Returns the raw text output from the model
 *
 * @throws {LexyBrainClientError} If LexyBrain is disabled or request fails
 * @throws {LexyBrainTimeoutError} If request exceeds timeout
 */
export async function callLexyBrainRaw(
  prompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    timeoutMs?: number;
  } = {}
): Promise<string> {
  // Check if LexyBrain is enabled
  if (!isLexyBrainEnabled()) {
    const error = new LexyBrainClientError(
      "LexyBrain is not enabled. Check LEXYBRAIN_ENABLE, LEXYBRAIN_MODEL_URL, and LEXYBRAIN_KEY environment variables."
    );
    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "client" },
    });
    throw error;
  }

  const baseUrl = getLexyBrainModelUrl();
  const lexyKey = getLexyBrainKey();
  const sloConfig = getLexyBrainSloConfig();
  const timeoutMs = options.timeoutMs || sloConfig.maxLatencyMs;

  // Validate URL format - must NOT use v2 API endpoints
  if (baseUrl.includes('api.runpod.ai/v2/')) {
    const error = new LexyBrainClientError(
      `LEXYBRAIN_MODEL_URL is incorrect. Expected: https://<endpoint-id>.api.runpod.ai (load balancing) ` +
      `or https://<endpoint-id>-<hash>.runpod.run (direct), Got: ${baseUrl}. ` +
      `The URL should point to the HTTP llama.cpp server, not the RunPod v2 job API.`
    );
    logger.error(
      {
        type: "lexybrain_config_error",
        provided_url: baseUrl,
        expected_format: "https://<endpoint-id>.api.runpod.ai or https://<endpoint-id>-<hash>.runpod.run",
      },
      "LexyBrain URL configuration error"
    );
    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "client" },
    });
    throw error;
  }

  // Build request payload for llama.cpp HTTP server
  const payload: LlamaCppCompletionRequest = {
    prompt,
    n_predict: options.maxTokens || 256, // Modest default for fast responses (can be overridden per request)
    temperature: options.temperature !== undefined ? options.temperature : 0.3,
    top_p: options.topP || 0.9,
    stop: ["</s>", "<|endoftext|>", "\n\n###"],
    stream: false,
  };

  // Build full URL - llama.cpp uses /completion endpoint
  const fullUrl = `${baseUrl}/completion`;

  logger.debug(
    {
      type: "lexybrain_request",
      base_url: baseUrl,
      full_url: fullUrl,
      prompt_length: prompt.length,
      n_predict: payload.n_predict,
      temperature: payload.temperature,
    },
    "Calling LexyBrain llama.cpp HTTP server"
  );

  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // Make request to llama.cpp HTTP server
    // CRITICAL: Load balancing endpoints require Authorization: Bearer header
    // This is validated by RunPod before traffic reaches the worker
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lexyKey}`, // REQUIRED: RunPod API key for load balancer
        "X-LEXYBRAIN-KEY": lexyKey, // OPTIONAL: Additional app-level authentication
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // Handle non-2xx responses
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unable to read error response");

      // Special handling for auth errors
      if (response.status === 401 || response.status === 403) {
        logger.error(
          {
            type: "lexybrain_auth_error",
            status: response.status,
            status_text: response.statusText,
            error_body: errorBody,
            latency_ms: latencyMs,
            request_url: fullUrl,
            base_url: baseUrl,
          },
          "LexyBrain unauthorized - verify Authorization: Bearer header uses correct RunPod API key"
        );

        const error = new LexyBrainClientError(
          `LexyBrain unauthorized (${response.status}). ` +
          `Verify: (1) LEXYBRAIN_MODEL_URL is correct (https://<endpoint>.api.runpod.ai for load balancing), ` +
          `(2) LEXYBRAIN_KEY contains the valid RunPod API key for Authorization: Bearer header. ` +
          `Note: Load balancing endpoints require Authorization header validated by RunPod before traffic reaches worker.`,
          response.status,
          errorBody
        );

        Sentry.captureException(error, {
          tags: {
            feature: "lexybrain",
            component: "client",
            status_code: response.status,
          },
          extra: {
            response_body: errorBody,
            base_url: baseUrl,
            request_url: fullUrl,
            latency_ms: latencyMs,
          },
        });

        throw error;
      }

      // Other errors
      logger.error(
        {
          type: "lexybrain_error",
          status: response.status,
          status_text: response.statusText,
          error_body: errorBody,
          latency_ms: latencyMs,
          request_url: fullUrl,
        },
        "LexyBrain HTTP request failed"
      );

      const error = new LexyBrainClientError(
        `LexyBrain request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );

      Sentry.captureException(error, {
        tags: {
          feature: "lexybrain",
          component: "client",
          status_code: response.status,
        },
        extra: {
          response_body: errorBody,
          base_url: baseUrl,
          request_url: fullUrl,
          latency_ms: latencyMs,
        },
      });

      throw error;
    }

    // Parse response from llama.cpp server
    // Read as text first, then parse as JSON to handle parsing errors better
    const responseText = await response.text().catch(() => {
      throw new LexyBrainClientError(
        "Failed to read LexyBrain response body",
        response.status
      );
    });

    let data: LlamaCppCompletionResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error(
        {
          type: "lexybrain_invalid_json",
          status: response.status,
          latency_ms: latencyMs,
          raw_text_preview: responseText.substring(0, 500),
          parse_error: parseError instanceof Error ? parseError.message : String(parseError),
        },
        "LexyBrain returned non-JSON response"
      );

      const error = new LexyBrainClientError(
        `LexyBrain returned invalid JSON response: ${responseText.substring(0, 200)}`,
        response.status,
        responseText
      );

      Sentry.captureException(error, {
        tags: {
          feature: "lexybrain",
          component: "client",
          status_code: response.status,
        },
        extra: {
          raw_response: responseText.substring(0, 1000),
          parse_error: parseError instanceof Error ? parseError.message : String(parseError),
          latency_ms: latencyMs,
        },
      });

      throw error;
    }

    logger.debug(
      {
        type: "lexybrain_response",
        has_content: !!data.content,
        has_generated_text: !!data.generated_text,
        tokens_predicted: data.tokens_predicted,
        latency_ms: latencyMs,
      },
      "LexyBrain llama.cpp response received"
    );

    // Extract output text - llama.cpp uses 'content' field
    const outputText =
      data.content ??
      data.generated_text ??
      "";

    if (!outputText || typeof outputText !== "string") {
      const error = new LexyBrainClientError(
        "LexyBrain response missing content field or invalid format",
        undefined,
        data
      );

      logger.error(
        {
          type: "lexybrain_invalid_response",
          response_keys: Object.keys(data),
          latency_ms: latencyMs,
        },
        "LexyBrain returned invalid response format"
      );

      Sentry.captureException(error, {
        tags: { feature: "lexybrain", component: "client" },
        extra: { response_data: data, latency_ms: latencyMs },
      });

      throw error;
    }

    logger.info(
      {
        type: "lexybrain_success",
        output_length: outputText.length,
        latency_ms: latencyMs,
        model_version: getLexyBrainModelVersion(),
        tokens_predicted: data.tokens_predicted,
        tokens_evaluated: data.tokens_evaluated,
      },
      "LexyBrain call completed successfully"
    );

    return outputText;
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      logger.error(
        {
          type: "lexybrain_timeout",
          timeout_ms: timeoutMs,
          latency_ms: latencyMs,
        },
        "LexyBrain request timed out"
      );

      const timeoutError = new LexyBrainTimeoutError(
        `LexyBrain request timed out after ${timeoutMs}ms`,
        timeoutMs
      );

      Sentry.captureException(timeoutError, {
        tags: { feature: "lexybrain", component: "client" },
        extra: { timeout_ms: timeoutMs, latency_ms: latencyMs },
      });

      throw timeoutError;
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes("fetch")) {
      logger.error(
        {
          type: "lexybrain_network_error",
          error: error.message,
          latency_ms: latencyMs,
        },
        "LexyBrain network error"
      );

      const networkError = new LexyBrainClientError(
        `Network error calling LexyBrain: ${error.message}`,
        undefined,
        error
      );

      Sentry.captureException(networkError, {
        tags: { feature: "lexybrain", component: "client" },
        extra: { original_error: error, latency_ms: latencyMs },
      });

      throw networkError;
    }

    // Re-throw if already a LexyBrainClientError
    if (error instanceof LexyBrainClientError) {
      throw error;
    }

    // Unknown error
    logger.error(
      {
        type: "lexybrain_unknown_error",
        error: error instanceof Error ? error.message : String(error),
        latency_ms: latencyMs,
      },
      "Unknown LexyBrain error"
    );

    const unknownError = new LexyBrainClientError(
      `Unknown error calling LexyBrain: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error
    );

    Sentry.captureException(unknownError, {
      tags: { feature: "lexybrain", component: "client" },
      extra: { original_error: error, latency_ms: latencyMs },
    });

    throw unknownError;
  }
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Test the LexyBrain connection with a simple prompt
 * Useful for health checks and debugging
 */
export async function testLexyBrainConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const testPrompt = 'You are LexyBrain. Return exactly {"status": "ok"}';
    const output = await callLexyBrainRaw(testPrompt, {
      maxTokens: 50,
      temperature: 0,
      timeoutMs: 10000, // 10 second timeout for tests
    });

    const latencyMs = Date.now() - startTime;

    logger.info(
      { type: "lexybrain_test", latency_ms: latencyMs, output_preview: output.substring(0, 100) },
      "LexyBrain connection test successful"
    );

    return { success: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        type: "lexybrain_test_failed",
        error: error instanceof Error ? error.message : String(error),
        latency_ms: latencyMs,
      },
      "LexyBrain connection test failed"
    );

    return {
      success: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract JSON from model output
 * Handles cases where the model includes extra text around the JSON
 */
export function extractJsonFromOutput(output: string): string {
  // Try to find JSON object or array in the output
  const jsonMatch =
    output.match(/\{[\s\S]*\}/) || output.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    return jsonMatch[0];
  }

  // If no JSON found, return the full output
  return output;
}
