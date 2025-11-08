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

/**
 * Extract JSON from model output
 * Handles cases where the model includes extra text around the JSON
 */
export function extractJsonFromOutput(output: string): string {
  // Strategy 1: Try to extract from markdown code blocks
  const codeBlockMatch = output.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    const extracted = codeBlockMatch[1].trim();
    if (extracted && (extracted.startsWith('{') || extracted.startsWith('['))) {
      try {
        JSON.parse(extracted);
        return extracted;
      } catch {
        // Continue to other strategies
      }
    }
  }

  // Strategy 2: Find all potential JSON structures using balanced bracket matching
  const jsonCandidates = findBalancedJsonStructures(output);

  // Try to parse each candidate and collect valid ones with their sizes
  const validCandidates: Array<{ json: string; size: number; keyCount: number }> = [];
  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      // Ensure it's a substantial object/array, not just {}
      if (typeof parsed === 'object' && parsed !== null) {
        const keyCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        if (keyCount > 0) {
          validCandidates.push({
            json: candidate,
            size: candidate.length,
            keyCount: keyCount,
          });
        }
      }
    } catch {
      // Invalid JSON, skip
      continue;
    }
  }

  // Return the largest valid JSON structure (by character count)
  // This helps avoid returning schema examples or small context objects
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => b.size - a.size);
    return validCandidates[0].json;
  }

  // Strategy 3: More aggressive - find content between first { and last }
  // This is the original behavior as a final fallback
  const fallbackMatch = output.match(/\{[\s\S]*\}/) || output.match(/\[[\s\S]*\]/);
  if (fallbackMatch) {
    return fallbackMatch[0];
  }

  // If no JSON found, return the full output
  return output;
}

/**
 * Find all balanced JSON structures (objects and arrays) in text
 * Uses character-by-character parsing to handle nested structures properly
 */
function findBalancedJsonStructures(text: string): string[] {
  const candidates: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '{' || char === '[') {
      const closingChar = char === '{' ? '}' : ']';
      let depth = 1;
      let inString = false;
      let escaped = false;

      for (let j = i + 1; j < text.length; j++) {
        const currentChar = text[j];

        // Handle string boundaries and escaping
        if (currentChar === '\\' && !escaped) {
          escaped = true;
          continue;
        }

        if (currentChar === '"' && !escaped) {
          inString = !inString;
        }

        escaped = false;

        // Only count brackets outside of strings
        if (!inString) {
          if (currentChar === char) {
            depth++;
          } else if (currentChar === closingChar) {
            depth--;

            if (depth === 0) {
              // Found a balanced structure
              const candidate = text.substring(i, j + 1);
              candidates.push(candidate);
              break;
            }
          }
        }
      }
    }
  }

  return candidates;
}
