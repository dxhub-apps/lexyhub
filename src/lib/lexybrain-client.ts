/**
 * LexyBrain Client - Low-Level RunPod Communication
 *
 * Handles direct communication with the RunPod-hosted Llama-3-8B endpoint.
 * This module is responsible for:
 * - HTTP requests to the model endpoint
 * - Authentication with RunPod
 * - Error handling and retries
 * - Timeout management
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

export interface RunPodRequest {
  input: {
    prompt: string;
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    stop?: string[];
  };
}

export interface RunPodResponse {
  id: string;
  status: string;
  output?: string | string[];
  error?: string;
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
 * Call the LexyBrain RunPod endpoint with a prompt
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

  const modelUrl = getLexyBrainModelUrl();
  const apiKey = getLexyBrainKey();
  const sloConfig = getLexyBrainSloConfig();
  const timeoutMs = options.timeoutMs || sloConfig.maxLatencyMs;

  // Build request payload
  const payload: RunPodRequest = {
    input: {
      prompt,
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      top_p: options.topP || 0.9,
      stop: ["</s>", "<|endoftext|>"],
    },
  };

  logger.debug(
    {
      type: "lexybrain_request",
      model_url: modelUrl,
      prompt_length: prompt.length,
      max_tokens: payload.input.max_tokens,
      temperature: payload.input.temperature,
    },
    "Calling LexyBrain RunPod endpoint"
  );

  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // Make request to RunPod endpoint
    const response = await fetch(`${modelUrl}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;

    // Handle non-2xx responses
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unable to read error response");

      logger.error(
        {
          type: "lexybrain_error",
          status: response.status,
          status_text: response.statusText,
          error_body: errorBody,
          latency_ms: latencyMs,
        },
        "LexyBrain RunPod request failed"
      );

      const error = new LexyBrainClientError(
        `RunPod request failed: ${response.status} ${response.statusText}`,
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
          model_url: modelUrl,
          latency_ms: latencyMs,
        },
      });

      throw error;
    }

    // Parse response
    const data: RunPodResponse = await response.json();

    logger.debug(
      {
        type: "lexybrain_response",
        response_id: data.id,
        status: data.status,
        has_output: !!data.output,
        latency_ms: latencyMs,
      },
      "LexyBrain RunPod response received"
    );

    // Check for errors in response
    if (data.error) {
      logger.error(
        {
          type: "lexybrain_error",
          error: data.error,
          latency_ms: latencyMs,
        },
        "LexyBrain returned error"
      );

      const error = new LexyBrainClientError(
        `RunPod returned error: ${data.error}`,
        undefined,
        data
      );

      Sentry.captureException(error, {
        tags: { feature: "lexybrain", component: "client" },
        extra: { response_data: data, latency_ms: latencyMs },
      });

      throw error;
    }

    // Extract output text
    let outputText: string;

    if (typeof data.output === "string") {
      outputText = data.output;
    } else if (Array.isArray(data.output) && data.output.length > 0) {
      outputText = data.output[0];
    } else {
      const error = new LexyBrainClientError(
        "RunPod response missing output field",
        undefined,
        data
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
        `Network error calling RunPod: ${error.message}`,
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
      `Unknown error calling RunPod: ${error instanceof Error ? error.message : String(error)}`,
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
    const testPrompt = 'Return this exact JSON: {"status": "ok"}';
    const output = await callLexyBrainRaw(testPrompt, {
      maxTokens: 50,
      temperature: 0,
      timeoutMs: 10000, // 10 second timeout for tests
    });

    const latencyMs = Date.now() - startTime;

    logger.info(
      { type: "lexybrain_test", latency_ms: latencyMs },
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
