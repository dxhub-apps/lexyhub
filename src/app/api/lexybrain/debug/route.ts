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

  // Mask the API key for security (show only last 4 chars)
  const maskedKey = env.LEXYBRAIN_KEY
    ? `***${env.LEXYBRAIN_KEY.slice(-4)}`
    : "NOT SET";

  return NextResponse.json({
    enabled: status.enabled,
    modelUrl: status.modelUrl,
    modelUrlWithRun: status.modelUrl ? `${status.modelUrl}/run` : null,
    modelVersion: status.modelVersion,
    hasApiKey: status.hasApiKey,
    apiKeyLastFourChars: maskedKey,
    dailyCostCap: status.dailyCostCap,
    maxLatencyMs: status.maxLatencyMs,
    // URL analysis
    urlAnalysis: {
      endsWithRun: status.modelUrl?.endsWith('/run') || false,
      endsWithRunsync: status.modelUrl?.endsWith('/runsync') || false,
      expectedFormat: "https://api.runpod.ai/v2/YOUR_ENDPOINT_ID (without /run suffix)",
      actualUrl: status.modelUrl || "NOT SET",
      computedRequestUrl: status.modelUrl ? `${status.modelUrl}/run` : "NOT SET",
      issue: status.modelUrl?.endsWith('/run')
        ? "⚠️ WARNING: URL ends with /run - this will cause double /run when making requests!"
        : status.modelUrl?.endsWith('/runsync')
        ? "⚠️ WARNING: URL ends with /runsync - code will append /run resulting in /runsync/run"
        : status.modelUrl
        ? "✅ OK: URL format looks correct"
        : "❌ URL not set"
    }
  });
}
