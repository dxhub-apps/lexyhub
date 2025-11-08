import { NextRequest, NextResponse } from "next/server";
import { callLexyBrainRunpod, testRunPodConnection } from "@/lib/lexybrain/runpodClient";

/**
 * Simple test endpoint to verify RunPod integration
 *
 * Usage from browser:
 * - GET: /api/test-runpod?message=your message here
 * - GET: /api/test-runpod?diagnostic=true (for connection diagnostic)
 * - POST: /api/test-runpod with JSON body { "message": "your message here" }
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Diagnostic mode
  if (searchParams.get("diagnostic") === "true") {
    console.log("[test-runpod] Running diagnostic test");
    try {
      const result = await testRunPodConnection();
      return NextResponse.json({
        diagnostic: true,
        timestamp: new Date().toISOString(),
        ...result,
      });
    } catch (error: any) {
      console.error("[test-runpod] Diagnostic test failed:", error);
      return NextResponse.json(
        {
          diagnostic: true,
          success: false,
          error: {
            message: error.message || "Unknown error occurred",
            type: error.constructor.name,
            details: error.toString(),
          },
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  }
  const message = searchParams.get("message") || "Hello from the browser! Please respond with a friendly greeting.";

  console.log(`[test-runpod] Testing with message: ${message.substring(0, 100)}`);

  try {
    const startTime = Date.now();

    console.log(`[test-runpod] Starting RunPod request at ${new Date().toISOString()}`);

    const result = await callLexyBrainRunpod({
      prompt: message,
      system: "You are a helpful assistant. Provide clear, concise responses.",
      max_tokens: 500,
      temperature: 0.7,
    });

    const duration = Date.now() - startTime;

    console.log(`[test-runpod] Request completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "RunPod test successful",
      request: {
        message,
        timestamp: new Date().toISOString(),
      },
      response: {
        completion: result.completion,
        duration_ms: duration,
      },
      raw_output: result,
    });
  } catch (error: any) {
    console.error("[test-runpod] RunPod test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message || "Unknown error occurred",
          type: error.constructor.name,
          details: error.toString(),
        },
        request: {
          message,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body.message || "Hello from the browser! Please respond with a friendly greeting.";
    const system = body.system || "You are a helpful assistant. Provide clear, concise responses.";
    const max_tokens = body.max_tokens || 500;
    const temperature = body.temperature || 0.7;

    console.log(`[test-runpod] POST request - Testing with message: ${message.substring(0, 100)}`);

    const startTime = Date.now();

    console.log(`[test-runpod] Starting RunPod request at ${new Date().toISOString()}`);

    const result = await callLexyBrainRunpod({
      prompt: message,
      system,
      max_tokens,
      temperature,
    });

    const duration = Date.now() - startTime;

    console.log(`[test-runpod] POST request completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "RunPod test successful",
      request: {
        message,
        system,
        max_tokens,
        temperature,
        timestamp: new Date().toISOString(),
      },
      response: {
        completion: result.completion,
        duration_ms: duration,
      },
      raw_output: result,
    });
  } catch (error: any) {
    console.error("[test-runpod] POST RunPod test error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message || "Unknown error occurred",
          type: error.constructor.name,
          details: error.toString(),
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
