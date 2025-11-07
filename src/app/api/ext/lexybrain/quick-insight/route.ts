// src/app/api/ext/lexybrain/quick-insight/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { isLexyBrainEnabled } from "@/lib/lexybrain-config";
import { generateLexyBrainJson } from "@/lib/lexybrain-json";
import { consumeLexyBrainQuota } from "@/lib/lexybrain-quota";
import type { LexyBrainOutputType } from "@/lib/lexybrain-schemas";

interface QuickInsightPayload {
  type: LexyBrainOutputType;
  market: string;
  keywords: string[];
  budget?: string;
}

/**
 * Quick Insight endpoint for Chrome Extension
 *
 * Provides instant AI-powered insights for keywords the user is viewing
 * in their browser. Optimized for speed and low latency.
 *
 * Usage:
 * POST /api/ext/lexybrain/quick-insight
 * {
 *   "type": "radar",
 *   "market": "etsy",
 *   "keywords": ["handmade jewelry", "silver rings"]
 * }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Check if LexyBrain is enabled
  if (!isLexyBrainEnabled()) {
    return NextResponse.json(
      { error: "LexyBrain is not enabled" },
      { status: 503 }
    );
  }

  // Authenticate extension
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit: 30 requests per minute for extension
  if (!checkRateLimit(context.userId, 30, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: QuickInsightPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { type, market, keywords, budget } = payload;

  // Validate
  if (!type || !["market_brief", "radar", "ad_insight", "risk"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid insight type. Must be: market_brief, radar, ad_insight, or risk" },
      { status: 400 }
    );
  }

  if (!market || !market.trim()) {
    return NextResponse.json(
      { error: "market is required" },
      { status: 400 }
    );
  }

  if (!Array.isArray(keywords) || keywords.length === 0 || keywords.length > 10) {
    return NextResponse.json(
      { error: "keywords must be an array with 1-10 items" },
      { status: 400 }
    );
  }

  if (type === "ad_insight" && !budget) {
    return NextResponse.json(
      { error: "budget is required for ad_insight type" },
      { status: 400 }
    );
  }

  try {
    // Build context
    const context_data: any = {
      market: market.toLowerCase().trim(),
      niche_terms: keywords.map(k => k.trim())
    };

    if (type === "ad_insight") {
      context_data.budget = budget;
    }

    // Check cache first (same logic as main API)
    const crypto = await import("crypto");
    const inputHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ type, context: context_data }))
      .digest("hex");

    // Import cache check utility
    const { getSupabaseServerClient } = await import("@/lib/supabase-server");
    const supabase = getSupabaseServerClient();

    let cachedResult = null;
    if (supabase) {
      const { data } = await supabase
        .from("ai_insights")
        .select("output_json")
        .eq("type", type)
        .eq("input_hash", inputHash)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (data) {
        cachedResult = data.output_json;
      }
    }

    // Check quota before generating (only if not cached)
    const quotaKey = type === "market_brief" ? "ai_brief" : "ai_calls";
    const quotaCheck = await consumeLexyBrainQuota(context.userId, quotaKey, cachedResult ? 0 : 1);

    if (!quotaCheck.allowed && !cachedResult) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          used: quotaCheck.used,
          limit: quotaCheck.limit,
          upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.lexyhub.com"}/billing`
        },
        { status: 402 } // Payment Required
      );
    }

    let insightData;
    let isCached = false;

    if (cachedResult) {
      // Use cached result
      insightData = cachedResult;
      isCached = true;
    } else {
      // Generate AI insight
      const insight = await generateLexyBrainJson({
        type,
        context: context_data,
        userId: context.userId
        // promptConfig is optional, omit for default
      });

      insightData = insight.output;
      isCached = false;
    }

    // Return compact response for extension
    return NextResponse.json({
      success: true,
      type,
      data: insightData,
      cached: isCached,
      quota: {
        used: quotaCheck.used,
        limit: quotaCheck.limit
      }
    });

  } catch (error: any) {
    console.error("Error in /api/ext/lexybrain/quick-insight:", error);

    return NextResponse.json(
      {
        error: "Failed to generate insight",
        message: error.message || "Internal server error",
        retry: true
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 20; // 20 second timeout for AI generation
