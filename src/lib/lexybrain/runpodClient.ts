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

  const timeoutMs = options?.timeoutMs || 55000; // Default 55s (under Vercel 60s limit)

  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input }),
        cache: "no-store",
        signal: abortController.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new RunPodClientError(
        `LexyBrain RunPod error: HTTP ${res.status} ${text || ""}`.trim(),
        res.status
      );
    }

    const data = (await res.json()) as {
      status?: string;
      output?: LexyBrainWorkerOutput;
    };

    if (data.status !== "COMPLETED") {
      throw new RunPodClientError(
        `LexyBrain RunPod incomplete status: ${data.status || "unknown"}`
      );
    }

    if (!data.output) {
      throw new RunPodClientError("LexyBrain RunPod response missing 'output'");
    }

    if (data.output.error) {
      throw new RunPodClientError(
        `LexyBrain worker error: ${data.output.error} (${data.output.error_type || "Unknown"})`
      );
    }

    if (!data.output.completion) {
      throw new RunPodClientError("LexyBrain worker returned no completion");
    }

    // normalize completion for consumers
    data.output.completion = normalizeCompletion(data.output.completion);

    return data.output;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      throw new RunPodTimeoutError(
        `LexyBrain RunPod request timed out after ${timeoutMs}ms`,
        timeoutMs
      );
    }

    // Re-throw if already our error type
    if (error instanceof RunPodClientError || error instanceof RunPodTimeoutError) {
      throw error;
    }

    // Wrap unknown errors
    throw new RunPodClientError(
      `LexyBrain RunPod error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
