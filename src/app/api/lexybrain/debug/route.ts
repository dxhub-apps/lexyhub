/**
 * LexyBrain Debug Endpoint
 *
 * Helps diagnose configuration issues by showing environment variable values
 */

import { NextResponse } from "next/server";
import { getLexyBrainStatus } from "@/lib/lexybrain-config";
import { getConfiguredProviderType } from "@/lib/lexybrain/providers";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const status = getLexyBrainStatus();
  const providerType = getConfiguredProviderType();

  // Mask the HF token for security (show only first 4 and last 4 chars)
  let maskedHfToken = "NOT SET";
  const hfToken = process.env.HF_TOKEN;
  if (hfToken) {
    const token = hfToken.trim();
    if (token.length > 8) {
      maskedHfToken = `${token.slice(0, 4)}...${token.slice(-4)} (length: ${token.length})`;
    } else {
      maskedHfToken = `****** (length: ${token.length})`;
    }
  }

  // HuggingFace configuration
  const hfModelId = process.env.LEXYBRAIN_MODEL_ID;

  // Legacy RunPod configuration (deprecated)
  let maskedRunpodKey = "NOT SET (Deprecated)";
  if (env.RUNPOD_API_KEY) {
    const key = env.RUNPOD_API_KEY.trim();
    if (key.length > 8) {
      maskedRunpodKey = `${key.slice(0, 4)}...${key.slice(-4)} (length: ${key.length})`;
    } else {
      maskedRunpodKey = `****** (length: ${key.length})`;
    }
  }

  return NextResponse.json({
    enabled: status.enabled,
    provider: providerType,
    modelVersion: status.modelVersion,

    // HuggingFace Configuration (Current)
    huggingface: {
      hasToken: !!hfToken,
      tokenMasked: maskedHfToken,
      modelId: hfModelId,
      tokenAnalysis: hfToken ? {
        hasWhitespace: hfToken !== hfToken.trim(),
        length: hfToken.trim().length,
        note: "This is the HuggingFace API token (REQUIRED for HuggingFace provider)",
        issue: hfToken.trim().length === 0
          ? "❌ Token is empty"
          : hfToken !== hfToken.trim()
          ? "⚠️ WARNING: Token has leading/trailing whitespace"
          : "✅ OK: Token is set and trimmed"
      } : {
        issue: "❌ HF_TOKEN not set - LexyBrain will not work!"
      },
    },

    // Legacy RunPod Configuration (Deprecated)
    runpod_deprecated: {
      usingServerlessQueue: status.usingServerlessQueue,
      hasRunPodApiKey: !!env.RUNPOD_API_KEY,
      runpodApiKeyMasked: maskedRunpodKey,
      endpointId: env.LEXYBRAIN_RUNPOD_ENDPOINT_ID || "826ys3jox3ev2n",
      note: "RunPod configuration is deprecated. Please migrate to HuggingFace provider.",
    },

    // General Configuration
    general: {
      dailyCostCap: status.dailyCostCap,
      maxLatencyMs: status.maxLatencyMs,
    },
  });
}
