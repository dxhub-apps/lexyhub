/**
 * LexyBrain Debug Endpoint
 *
 * Helps diagnose configuration issues by showing environment variable values
 */

import { NextResponse } from "next/server";
import { getLexyBrainStatus } from "@/lib/lexybrain-config";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const status = getLexyBrainStatus();

  // Mask the RunPod API key for security (show only first 4 and last 4 chars)
  let maskedKey = "NOT SET";
  if (env.RUNPOD_API_KEY) {
    const key = env.RUNPOD_API_KEY.trim();
    if (key.length > 8) {
      maskedKey = `${key.slice(0, 4)}...${key.slice(-4)} (length: ${key.length})`;
    } else {
      maskedKey = `****** (length: ${key.length})`;
    }
  }

  // Endpoint ID and URL construction
  const endpointId = env.LEXYBRAIN_RUNPOD_ENDPOINT_ID || "826ys3jox3ev2n";
  const runsyncUrl = `https://api.runpod.ai/v2/${endpointId}/runsync`;

  return NextResponse.json({
    enabled: status.enabled,
    usingServerlessQueue: status.usingServerlessQueue,
    modelVersion: status.modelVersion,
    endpointId,
    runsyncUrl,
    hasRunPodApiKey: !!env.RUNPOD_API_KEY,
    runpodApiKeyMasked: maskedKey,
    dailyCostCap: status.dailyCostCap,
    maxLatencyMs: status.maxLatencyMs,
    // RunPod API key analysis
    runpodApiKeyAnalysis: env.RUNPOD_API_KEY ? {
      hasWhitespace: env.RUNPOD_API_KEY !== env.RUNPOD_API_KEY.trim(),
      length: env.RUNPOD_API_KEY.trim().length,
      note: "This is the RunPod API key for Authorization: Bearer header (REQUIRED for Serverless Queue)",
      issue: env.RUNPOD_API_KEY.trim().length === 0
        ? "❌ Key is empty"
        : env.RUNPOD_API_KEY !== env.RUNPOD_API_KEY.trim()
        ? "⚠️ WARNING: Key has leading/trailing whitespace"
        : "✅ OK: Key is set and trimmed"
    } : {
      issue: "❌ RUNPOD_API_KEY not set"
    },
  });
}
