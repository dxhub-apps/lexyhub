/**
 * LexyBrain Auth Test Endpoint
 *
 * Tests the actual RunPod authentication with minimal payload
 * Helps diagnose 401 errors
 *
 * Tests the llama.cpp /completion endpoint with Authorization: Bearer header
 * (required for load balancing endpoints)
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

  // Build full URL for llama.cpp /completion endpoint
  const fullUrl = `${modelUrl}/completion`;

  // Test with minimal llama.cpp completion payload
  const testPayload = {
    prompt: "Hello",
    n_predict: 10,
    temperature: 0.0,
  };

  try {
    const startTime = Date.now();

    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`, // REQUIRED for load balancing endpoints
        "X-LEXYBRAIN-KEY": apiKey, // OPTIONAL app-level auth
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
        xLexyBrainKey: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`,
        contentType: "application/json",
      },
      requestPayload: {
        prompt: testPayload.prompt,
        n_predict: testPayload.n_predict,
        temperature: testPayload.temperature,
      },
      responseBody: responseText,
      diagnostics: {
        apiKeyLength: apiKey.length,
        apiKeyPrefix: apiKey.slice(0, 4),
        apiKeySuffix: apiKey.slice(-4),
        apiKeyHasWhitespace: apiKey !== apiKey.trim(),
        urlHasWhitespace: modelUrl !== modelUrl.trim(),
        endpointType: "llama.cpp /completion (load balancing)",
        authNote: "Authorization: Bearer header is REQUIRED for load balancing endpoints",
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      requestUrl: fullUrl,
      diagnostics: {
        note: "Failed to connect to LexyBrain endpoint",
      },
    }, { status: 500 });
  }
}
