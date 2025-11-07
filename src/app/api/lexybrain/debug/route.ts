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
      endsWithRun: status.modelUrl?.endsWith('/run') || false,
      endsWithRunsync: status.modelUrl?.endsWith('/runsync') || false,
      expectedFormat: "https://api.runpod.ai/v2/YOUR_ENDPOINT_ID (with or without /run suffix)",
      actualUrl: status.modelUrl || "NOT SET",
      computedRequestUrl: status.modelUrl ?
        (status.modelUrl.endsWith('/run') || status.modelUrl.endsWith('/runsync')
          ? status.modelUrl
          : `${status.modelUrl}/run`)
        : "NOT SET",
      hasWhitespace: status.modelUrl ? status.modelUrl !== status.modelUrl.trim() : false,
      issue: status.modelUrl?.endsWith('/run')
        ? "✅ OK: URL ends with /run - will use as-is"
        : status.modelUrl?.endsWith('/runsync')
        ? "⚠️ INFO: URL ends with /runsync - will use as-is (not typical)"
        : status.modelUrl
        ? "✅ OK: URL without suffix - code will append /run"
        : "❌ URL not set"
    },
    // API key analysis
    apiKeyAnalysis: env.LEXYBRAIN_KEY ? {
      hasWhitespace: env.LEXYBRAIN_KEY !== env.LEXYBRAIN_KEY.trim(),
      startsWithRunpod: env.LEXYBRAIN_KEY.trim().startsWith('runpod_'),
      startsWithRpa: env.LEXYBRAIN_KEY.trim().startsWith('rpa_'),
      length: env.LEXYBRAIN_KEY.trim().length,
      issue: !env.LEXYBRAIN_KEY.trim().startsWith('runpod_') && !env.LEXYBRAIN_KEY.trim().startsWith('rpa_')
        ? "⚠️ WARNING: API key doesn't start with 'runpod_' or 'rpa_' - might be invalid format"
        : "✅ OK: API key format looks correct"
    } : null,
    // Connection test
    connectionTest,
  });
}
