/**
 * RunPod Serverless Queue Client for LexyBrain
 *
 * Handles communication with RunPod Serverless Queue endpoint for LexyBrain inference.
 *
 * ARCHITECTURE:
 * - Uses RunPod Serverless Queue API (v2/runsync)
 * - Endpoint ID: 826ys3jox3ev2n (configurable via env)
 * - Authentication: Authorization: Bearer <RUNPOD_API_KEY>
 * - Request format: { "input": { ... } }
 * - Response format: { "status": "COMPLETED", "output": { ... } }
 *
 * MIGRATION FROM LOAD BALANCER:
 * - Old: Direct llama.cpp HTTP server via load balancer (/completion)
 * - New: RunPod Serverless Queue with worker handler (/runsync)
 */

import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

// =====================================================
// Types
// =====================================================

/**
 * LexyBrain request input structure
 */
export interface LexyBrainRequest {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
}

/**
 * LexyBrain response output structure
 */
export interface LexyBrainResponse {
  content: string;
  tokens_predicted?: number;
  tokens_evaluated?: number;
  model?: string;
  timings?: {
    prompt_ms?: number;
    predicted_ms?: number;
    total_ms?: number;
  };
}

/**
 * RunPod API error response
 */
export interface RunPodErrorResponse {
  error: string;
  message?: string;
}

/**
 * RunPod API success response
 */
export interface RunPodSuccessResponse {
  id: string;
  status: "COMPLETED" | "FAILED" | "IN_QUEUE" | "IN_PROGRESS";
  output?: LexyBrainResponse;
  error?: string;
}

export class RunPodClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message);
    this.name = "RunPodClientError";
  }
}

export class RunPodTimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = "RunPodTimeoutError";
  }
}

// =====================================================
// Configuration
// =====================================================

/**
 * Get RunPod API key from environment
 */
function getRunPodApiKey(): string {
  const apiKey = process.env.RUNPOD_API_KEY;
  if (!apiKey) {
    throw new RunPodClientError(
      "RUNPOD_API_KEY environment variable is not set. " +
      "Please configure your RunPod API key for serverless queue access."
    );
  }
  return apiKey.trim();
}

/**
 * Get RunPod endpoint ID from environment
 * Defaults to 826ys3jox3ev2n if not specified
 */
function getRunPodEndpointId(): string {
  const endpointId = process.env.LEXYBRAIN_RUNPOD_ENDPOINT_ID;
  if (!endpointId) {
    // Default to the specified endpoint
    return "826ys3jox3ev2n";
  }
  return endpointId.trim();
}

/**
 * Check if RunPod Serverless Queue is enabled
 */
export function isRunPodEnabled(): boolean {
  try {
    getRunPodApiKey();
    return true;
  } catch {
    return false;
  }
}

// =====================================================
// Core Client Function
// =====================================================

/**
 * Call LexyBrain via RunPod Serverless Queue
 *
 * This function sends inference requests to the RunPod Serverless Queue worker.
 * The worker handles the llama.cpp interaction and returns structured responses.
 *
 * @param input - LexyBrain request parameters
 * @param options - Additional options (timeout, etc.)
 * @returns LexyBrain response with generated content
 * @throws {RunPodClientError} If request fails or response is invalid
 * @throws {RunPodTimeoutError} If request exceeds timeout
 */
export async function callLexyBrainRunpod(
  input: LexyBrainRequest,
  options: {
    timeoutMs?: number;
  } = {}
): Promise<LexyBrainResponse> {
  // Get configuration
  const apiKey = getRunPodApiKey();
  const endpointId = getRunPodEndpointId();
  const timeoutMs = options.timeoutMs || 55000; // Default 55s (under Vercel 60s limit)

  // Build RunPod API URL
  const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  // Build request payload
  const payload = {
    input: {
      prompt: input.prompt,
      max_tokens: input.max_tokens || 256,
      temperature: input.temperature !== undefined ? input.temperature : 0.3,
      top_p: input.top_p || 0.9,
      stop: input.stop || ["</s>", "<|endoftext|>", "\n\n###"],
    },
  };

  logger.debug(
    {
      type: "runpod_request",
      endpoint_id: endpointId,
      url,
      prompt_length: input.prompt.length,
      max_tokens: payload.input.max_tokens,
      temperature: payload.input.temperature,
    },
    "Calling RunPod Serverless Queue for LexyBrain"
  );

  const startTime = Date.now();

  try {
    // Create abort controller for timeout
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

    // Make request to RunPod Serverless Queue
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
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
            type: "runpod_auth_error",
            status: response.status,
            status_text: response.statusText,
            error_body: errorBody,
            latency_ms: latencyMs,
            endpoint_id: endpointId,
          },
          "RunPod authentication failed - verify RUNPOD_API_KEY"
        );

        const error = new RunPodClientError(
          `RunPod authentication failed (${response.status}). ` +
          `Verify RUNPOD_API_KEY is correct and has access to endpoint ${endpointId}.`,
          response.status,
          errorBody
        );

        Sentry.captureException(error, {
          tags: {
            feature: "lexybrain",
            component: "runpod-client",
            status_code: response.status,
          },
          extra: {
            response_body: errorBody,
            endpoint_id: endpointId,
            latency_ms: latencyMs,
          },
        });

        throw error;
      }

      // Other errors
      logger.error(
        {
          type: "runpod_error",
          status: response.status,
          status_text: response.statusText,
          error_body: errorBody,
          latency_ms: latencyMs,
          endpoint_id: endpointId,
        },
        "RunPod request failed"
      );

      const error = new RunPodClientError(
        `RunPod request failed: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );

      Sentry.captureException(error, {
        tags: {
          feature: "lexybrain",
          component: "runpod-client",
          status_code: response.status,
        },
        extra: {
          response_body: errorBody,
          endpoint_id: endpointId,
          latency_ms: latencyMs,
        },
      });

      throw error;
    }

    // Parse response
    const responseText = await response.text().catch(() => {
      throw new RunPodClientError(
        "Failed to read RunPod response body",
        response.status
      );
    });

    let data: RunPodSuccessResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      logger.error(
        {
          type: "runpod_invalid_json",
          status: response.status,
          latency_ms: latencyMs,
          raw_text_preview: responseText.substring(0, 500),
          parse_error: parseError instanceof Error ? parseError.message : String(parseError),
        },
        "RunPod returned non-JSON response"
      );

      const error = new RunPodClientError(
        `RunPod returned invalid JSON response: ${responseText.substring(0, 200)}`,
        response.status,
        responseText
      );

      Sentry.captureException(error, {
        tags: {
          feature: "lexybrain",
          component: "runpod-client",
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
        type: "runpod_response",
        status: data.status,
        has_output: !!data.output,
        has_error: !!data.error,
        latency_ms: latencyMs,
      },
      "RunPod response received"
    );

    // Check response status
    if (data.status !== "COMPLETED") {
      const error = new RunPodClientError(
        `RunPod worker did not complete successfully. Status: ${data.status}${data.error ? `, Error: ${data.error}` : ""}`,
        undefined,
        data
      );

      logger.error(
        {
          type: "runpod_incomplete",
          status: data.status,
          error: data.error,
          latency_ms: latencyMs,
        },
        "RunPod worker did not complete"
      );

      Sentry.captureException(error, {
        tags: { feature: "lexybrain", component: "runpod-client" },
        extra: { response_data: data, latency_ms: latencyMs },
      });

      throw error;
    }

    // Validate output
    if (!data.output) {
      const error = new RunPodClientError(
        "RunPod response missing output field",
        undefined,
        data
      );

      logger.error(
        {
          type: "runpod_missing_output",
          status: data.status,
          latency_ms: latencyMs,
        },
        "RunPod response missing output"
      );

      Sentry.captureException(error, {
        tags: { feature: "lexybrain", component: "runpod-client" },
        extra: { response_data: data, latency_ms: latencyMs },
      });

      throw error;
    }

    // Validate content in output
    if (!data.output.content || typeof data.output.content !== "string") {
      const error = new RunPodClientError(
        "RunPod output missing or invalid content field",
        undefined,
        data.output
      );

      logger.error(
        {
          type: "runpod_invalid_output",
          output_keys: Object.keys(data.output),
          latency_ms: latencyMs,
        },
        "RunPod output invalid"
      );

      Sentry.captureException(error, {
        tags: { feature: "lexybrain", component: "runpod-client" },
        extra: { output_data: data.output, latency_ms: latencyMs },
      });

      throw error;
    }

    logger.info(
      {
        type: "runpod_success",
        output_length: data.output.content.length,
        latency_ms: latencyMs,
        tokens_predicted: data.output.tokens_predicted,
        tokens_evaluated: data.output.tokens_evaluated,
      },
      "RunPod call completed successfully"
    );

    return data.output;
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      logger.error(
        {
          type: "runpod_timeout",
          timeout_ms: timeoutMs,
          latency_ms: latencyMs,
          endpoint_id: endpointId,
        },
        "RunPod request timed out"
      );

      const timeoutError = new RunPodTimeoutError(
        `RunPod request timed out after ${timeoutMs}ms`,
        timeoutMs
      );

      Sentry.captureException(timeoutError, {
        tags: { feature: "lexybrain", component: "runpod-client" },
        extra: { timeout_ms: timeoutMs, latency_ms: latencyMs, endpoint_id: endpointId },
      });

      throw timeoutError;
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes("fetch")) {
      logger.error(
        {
          type: "runpod_network_error",
          error: error.message,
          latency_ms: latencyMs,
          endpoint_id: endpointId,
        },
        "RunPod network error"
      );

      const networkError = new RunPodClientError(
        `Network error calling RunPod: ${error.message}`,
        undefined,
        error
      );

      Sentry.captureException(networkError, {
        tags: { feature: "lexybrain", component: "runpod-client" },
        extra: { original_error: error, latency_ms: latencyMs, endpoint_id: endpointId },
      });

      throw networkError;
    }

    // Re-throw if already a RunPodClientError
    if (error instanceof RunPodClientError || error instanceof RunPodTimeoutError) {
      throw error;
    }

    // Unknown error
    logger.error(
      {
        type: "runpod_unknown_error",
        error: error instanceof Error ? error.message : String(error),
        latency_ms: latencyMs,
        endpoint_id: endpointId,
      },
      "Unknown RunPod error"
    );

    const unknownError = new RunPodClientError(
      `Unknown error calling RunPod: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error
    );

    Sentry.captureException(unknownError, {
      tags: { feature: "lexybrain", component: "runpod-client" },
      extra: { original_error: error, latency_ms: latencyMs, endpoint_id: endpointId },
    });

    throw unknownError;
  }
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Test the RunPod connection with a simple prompt
 * Useful for health checks and debugging
 */
export async function testRunPodConnection(): Promise<{
  success: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const testPrompt = 'You are LexyBrain. Return exactly {"status": "ok"}';
    const output = await callLexyBrainRunpod(
      {
        prompt: testPrompt,
        max_tokens: 50,
        temperature: 0,
      },
      {
        timeoutMs: 10000, // 10 second timeout for tests
      }
    );

    const latencyMs = Date.now() - startTime;

    logger.info(
      { type: "runpod_test", latency_ms: latencyMs, output_preview: output.content.substring(0, 100) },
      "RunPod connection test successful"
    );

    return { success: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        type: "runpod_test_failed",
        error: error instanceof Error ? error.message : String(error),
        latency_ms: latencyMs,
      },
      "RunPod connection test failed"
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
