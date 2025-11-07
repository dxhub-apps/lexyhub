/**
 * LexyBrain Auth Test Endpoint
 *
 * Tests the actual RunPod authentication with minimal payload
 * Helps diagnose 401 errors
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // Check if config exists
  if (!env.LEXYBRAIN_MODEL_URL || !env.LEXYBRAIN_KEY) {
    return NextResponse.json({
      error: "Configuration missing",
      hasUrl: !!env.LEXYBRAIN_MODEL_URL,
      hasKey: !!env.LEXYBRAIN_KEY,
    }, { status: 500 });
  }

  const modelUrl = env.LEXYBRAIN_MODEL_URL.trim();
  const apiKey = env.LEXYBRAIN_KEY.trim();

  // Build full URL
  let fullUrl = modelUrl;
  if (!modelUrl.endsWith('/run') && !modelUrl.endsWith('/runsync')) {
    fullUrl = `${modelUrl}/run`;
  }

  // Test with minimal payload (exactly like your working curl)
  const testPayload = {
    input: {
      prompt: "Hello"
    }
  };

  try {
    const startTime = Date.now();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    const latency = Date.now() - startTime;
    const responseText = await response.text();

    // Return detailed diagnostics
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs: latency,
      requestUrl: fullUrl,
      requestHeaders: {
        authorization: `Bearer ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        contentType: "application/json",
      },
      responseBody: responseText,
      diagnostics: {
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.slice(0, 4),
        apiKeySuffix: apiKey.slice(-4),
        apiKeyHasWhitespace: apiKey !== apiKey.trim(),
        urlHasWhitespace: modelUrl !== modelUrl.trim(),
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      requestUrl: fullUrl,
    }, { status: 500 });
  }
}
