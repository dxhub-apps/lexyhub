// lib/lexybrain/runpodClient.ts
"use server";

import { RunPodClientError, RunPodTimeoutError } from "./errors";

const ENDPOINT_ID =
  process.env.LEXYBRAIN_RUNPOD_ENDPOINT_ID || "826ys3jox3ev2n";
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

if (!RUNPOD_API_KEY) {
  // Fail fast in non-dev to avoid silent misconfig
  if (process.env.NODE_ENV !== "development") {
    throw new Error("RUNPOD_API_KEY is not set");
  }
}

// Log configuration on module load
console.log(`[RunPod] Module loaded with configuration:`);
console.log(`[RunPod] - Endpoint ID: ${ENDPOINT_ID}`);
console.log(`[RunPod] - API Key configured: ${!!RUNPOD_API_KEY}`);
console.log(`[RunPod] - Environment: ${process.env.NODE_ENV}`);

/**
 * Test RunPod endpoint connectivity and health
 * Returns diagnostic information about the endpoint
 */
export async function testRunPodConnection(): Promise<{
  success: boolean;
  endpointId: string;
  hasApiKey: boolean;
  message: string;
  details?: any;
}> {
  console.log(`[RunPod] Testing connection to endpoint ${ENDPOINT_ID}`);

  if (!RUNPOD_API_KEY) {
    return {
      success: false,
      endpointId: ENDPOINT_ID,
      hasApiKey: false,
      message: "RUNPOD_API_KEY is not configured",
    };
  }

  try {
    // Test with a simple request
    const testInput: LexyBrainRequest = {
      prompt: "Say 'hello' in one word",
      system: "You are a helpful assistant. Respond concisely.",
      max_tokens: 10,
      temperature: 0.7,
    };

    const response = await callLexyBrainRunpod(testInput, { timeoutMs: 30000 });

    return {
      success: true,
      endpointId: ENDPOINT_ID,
      hasApiKey: true,
      message: "Connection successful",
      details: {
        model: response.model,
        completionLength: response.completion?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      endpointId: ENDPOINT_ID,
      hasApiKey: true,
      message: error instanceof Error ? error.message : String(error),
      details: {
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      },
    };
  }
}

export type LexyBrainRequest = {
  prompt: string;
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  // structured context you pass from the app
  context?: Record<string, any>;
};

export type LexyBrainWorkerOutput = {
  model: string;
  completion: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  meta?: {
    latency_ms?: number;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
  // error shape if worker fails internally
  error?: string;
  error_type?: string;
};

function normalizeCompletion(raw: string): string {
  // Worker currently may wrap JSON in backticks; strip simple markdown artifacts.
  return raw.trim().replace(/^`+|`+$/g, "");
}

export async function callLexyBrainRunpod(
  input: LexyBrainRequest,
  options?: { timeoutMs?: number }
): Promise<LexyBrainWorkerOutput> {
  if (!RUNPOD_API_KEY) {
    throw new RunPodClientError("LexyBrain is not configured (missing RUNPOD_API_KEY)");
  }

  const timeoutMs = options?.timeoutMs || 25000; // Default 25s (allows retries within Vercel 60s limit)
  const url = `https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`;
  const requestBody = { input };

  // Log request details for debugging
  console.log(`[RunPod] Initiating request to ${url}`);
  console.log(`[RunPod] Endpoint ID: ${ENDPOINT_ID}`);
  console.log(`[RunPod] Full request body:`, JSON.stringify(requestBody, null, 2));
  console.log(`[RunPod] Request body structure:`, {
    hasPrompt: !!input.prompt,
    hasSystem: !!input.system,
    maxTokens: input.max_tokens,
    temperature: input.temperature,
    promptLength: input.prompt?.length || 0,
  });
  console.log(`[RunPod] Timeout: ${timeoutMs}ms`);
  console.log(`[RunPod] API Key present: ${!!RUNPOD_API_KEY}`);

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[RunPod] Request timeout triggered after ${timeoutMs}ms - aborting fetch`);
    abortController.abort();
  }, timeoutMs);

  try {
    console.log(`[RunPod] Sending fetch request at ${new Date().toISOString()}`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
      signal: abortController.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[RunPod] Received response with status: ${res.status} at ${new Date().toISOString()}`);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[RunPod] Error response (${res.status}):`, text.substring(0, 500));
      throw new RunPodClientError(
        `LexyBrain RunPod error: HTTP ${res.status} ${text || ""}`.trim(),
        res.status
      );
    }

    const data = (await res.json()) as {
      status?: string;
      output?: LexyBrainWorkerOutput;
    };

    console.log(`[RunPod] Response data:`, {
      status: data.status,
      hasOutput: !!data.output,
      outputKeys: data.output ? Object.keys(data.output) : [],
    });

    if (data.status !== "COMPLETED") {
      console.error(`[RunPod] Incomplete status: ${data.status}`);
      throw new RunPodClientError(
        `LexyBrain RunPod incomplete status: ${data.status || "unknown"}`
      );
    }

    if (!data.output) {
      console.error(`[RunPod] Missing output in response`);
      throw new RunPodClientError("LexyBrain RunPod response missing 'output'");
    }

    if (data.output.error) {
      console.error(`[RunPod] Worker error: ${data.output.error} (${data.output.error_type})`);
      throw new RunPodClientError(
        `LexyBrain worker error: ${data.output.error} (${data.output.error_type || "Unknown"})`
      );
    }

    if (!data.output.completion) {
      console.error(`[RunPod] Worker returned no completion`);
      throw new RunPodClientError("LexyBrain worker returned no completion");
    }

    // normalize completion for consumers
    data.output.completion = normalizeCompletion(data.output.completion);

    console.log(`[RunPod] Request completed successfully, completion length: ${data.output.completion.length}`);
    return data.output;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[RunPod] Request aborted after timeout of ${timeoutMs}ms`);
      console.error(`[RunPod] This means the fetch() call did not complete within the timeout period`);
      console.error(`[RunPod] Possible causes: network issues, DNS resolution failure, server not responding, or slow worker startup`);
      throw new RunPodTimeoutError(
        `LexyBrain RunPod request timed out after ${timeoutMs}ms`,
        timeoutMs
      );
    }

    // Log network/fetch errors
    if (error instanceof Error) {
      console.error(`[RunPod] Fetch error:`, {
        name: error.name,
        message: error.message,
        stack: error.stack?.substring(0, 500),
      });
    }

    // Re-throw if already our error type
    if (error instanceof RunPodClientError || error instanceof RunPodTimeoutError) {
      throw error;
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[RunPod] Unexpected error: ${errorMessage}`);
    throw new RunPodClientError(
      `LexyBrain RunPod error: ${errorMessage}`
    );
  }
}
