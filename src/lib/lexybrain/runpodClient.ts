// lib/lexybrain/runpodClient.ts
"use server";

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

export async function callLexyBrainRunpod(
  input: LexyBrainRequest
): Promise<LexyBrainWorkerOutput> {
  if (!RUNPOD_API_KEY) {
    throw new Error("LexyBrain is not configured (missing RUNPOD_API_KEY)");
  }

  const res = await fetch(
    `https://api.runpod.ai/v2/${ENDPOINT_ID}/runsync`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input }),
      // 30s hard cap; adjust if needed
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `LexyBrain RunPod error: HTTP ${res.status} ${text || ""}`.trim()
    );
  }

  const data = (await res.json()) as {
    status?: string;
    output?: LexyBrainWorkerOutput;
  };

  if (data.status !== "COMPLETED") {
    throw new Error(
      `LexyBrain RunPod incomplete status: ${data.status || "unknown"}`
    );
  }

  if (!data.output) {
    throw new Error("LexyBrain RunPod response missing 'output'");
  }

  if (data.output.error) {
    throw new Error(
      `LexyBrain worker error: ${data.output.error} (${data.output.error_type || "Unknown"})`
    );
  }

  if (!data.output.completion) {
    throw new Error("LexyBrain worker returned no completion");
  }

  return data.output;
}
