/**
 * LexyBrain Debug Endpoint
 *
 * Helps diagnose configuration issues by showing environment variable values
 */

import { NextResponse } from "next/server";
import { getLexyBrainStatus } from "@/lib/lexybrain-config";
import { env } from "@/lib/env";
import { testLexyBrainConnection } from "@/lib/lexybrain-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const status = getLexyBrainStatus();

  // Mask the API key for security (show only first 4 and last 4 chars)
  let maskedKey = "NOT SET";
  if (env.LEXYBRAIN_KEY) {
    const key = env.LEXYBRAIN_KEY.trim();
    if (key.length > 8) {
      maskedKey = `${key.slice(0, 4)}...${key.slice(-4)} (length: ${key.length})`;
    } else {
      maskedKey = `****** (length: ${key.length})`;
    }
  }

  // Test connection (only if enabled)
  let connectionTest = null;
  if (status.enabled) {
    try {
      connectionTest = await testLexyBrainConnection();
    } catch (error) {
      connectionTest = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return NextResponse.json({
    enabled: status.enabled,
    modelUrl: status.modelUrl,
    modelUrlWithRun: status.modelUrl ? `${status.modelUrl}/run` : null,
    modelVersion: status.modelVersion,
    hasApiKey: status.hasApiKey,
    apiKeyMasked: maskedKey,
    dailyCostCap: status.dailyCostCap,
    maxLatencyMs: status.maxLatencyMs,
    // URL analysis
    urlAnalysis: {
      isRunPodRun: status.modelUrl?.includes('.runpod.run') || false,
      isApiV2: status.modelUrl?.includes('api.runpod.ai/v2/') || false,
      expectedFormat: "https://<endpoint-id>-<hash>.runpod.run (llama.cpp HTTP server)",
      actualUrl: status.modelUrl || "NOT SET",
      computedRequestUrl: status.modelUrl ? `${status.modelUrl}/completion` : "NOT SET",
      hasWhitespace: status.modelUrl ? status.modelUrl !== status.modelUrl.trim() : false,
      issue: !status.modelUrl
        ? "❌ URL not set"
        : status.modelUrl.includes('api.runpod.ai/v2/')
        ? "❌ WRONG: Using RunPod job API URL. Must use llama.cpp HTTP server URL: https://<endpoint>-<hash>.runpod.run"
        : status.modelUrl.includes('.runpod.run')
        ? "✅ OK: Correct llama.cpp HTTP server URL format"
        : "⚠️ WARNING: URL format unexpected - should be https://<endpoint>-<hash>.runpod.run"
    },
    // API key analysis (shared secret, not RunPod API key)
    apiKeyAnalysis: env.LEXYBRAIN_KEY ? {
      hasWhitespace: env.LEXYBRAIN_KEY !== env.LEXYBRAIN_KEY.trim(),
      length: env.LEXYBRAIN_KEY.trim().length,
      note: "This is the shared secret for X-LEXYBRAIN-KEY header, NOT a RunPod API key",
      issue: env.LEXYBRAIN_KEY.trim().length === 0
        ? "❌ Key is empty"
        : env.LEXYBRAIN_KEY !== env.LEXYBRAIN_KEY.trim()
        ? "⚠️ WARNING: Key has leading/trailing whitespace"
        : "✅ OK: Key is set and trimmed"
    } : null,
    // Connection test
    connectionTest,
  });
}
