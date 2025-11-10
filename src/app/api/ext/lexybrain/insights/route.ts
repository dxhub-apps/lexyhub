// src/app/api/ext/lexybrain/insights/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { isLexyBrainEnabled } from "@/lib/lexybrain-config";
import { generateLexyBrainJson } from "@/lib/lexybrain-json";
import { consumeLexyBrainQuota } from "@/lib/lexybrain-quota";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface LexyBrainInsightsPayload {
  keyword_id?: string;
  term: string;
  marketplace: string;
  url?: string;
  capability?: string;
  source?: string;
}

/**
 * LexyBrain Insights endpoint for Chrome Extension v4
 *
 * Provides deterministic LexyBrain insights for keywords
 * Supports multiple capabilities with intelligent fallbacks
 *
 * This endpoint ensures no local AI processing in the extension -
 * all intelligence comes from LexyHub's unified LexyBrain system
 *
 * Usage:
 * POST /api/ext/lexybrain/insights
 * {
 *   "term": "handmade jewelry",
 *   "keyword_id": "uuid-optional",
 *   "marketplace": "etsy",
 *   "url": "https://www.etsy.com/search?q=handmade+jewelry",
 *   "capability": "keyword_insights",
 *   "source": "extension"
 * }
 *
 * Response:
 * {
 *   "keyword": "handmade jewelry",
 *   "metrics": {
 *     "demand": 0.85,
 *     "competition": 0.62,
 *     "momentum": "rising",
 *     "risk": "medium",
 *     "ai_score": 0.73
 *   },
 *   "insights": [
 *     "High demand with manageable competition",
 *     "Seasonal peak expected in Q4",
 *     "Consider long-tail variations"
 *   ],
 *   "status": "success"
 * }
 *
 * Or if no data:
 * {
 *   "keyword": "random term",
 *   "status": "no_data",
 *   "message": "No reliable data available for this keyword"
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

  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit: 30 requests per minute for LexyBrain calls
  if (!checkRateLimit(context.userId, 30, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment." },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: LexyBrainInsightsPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { term, keyword_id, marketplace, url, capability, source } = payload;

  // Validate
  if (!term || !term.trim()) {
    return NextResponse.json({ error: "term is required" }, { status: 400 });
  }

  if (!marketplace || !marketplace.trim()) {
    return NextResponse.json(
      { error: "marketplace is required" },
      { status: 400 }
    );
  }

  const validMarkets = [
    "etsy",
    "amazon",
    "ebay",
    "walmart",
    "shopify",
    "google",
    "pinterest",
    "reddit",
    "bing",
  ];

  const normalizedMarket = marketplace.toLowerCase().trim();
  if (!validMarkets.includes(normalizedMarket)) {
    return NextResponse.json(
      { error: `marketplace must be one of: ${validMarkets.join(", ")}` },
      { status: 400 }
    );
  }

  // Get Supabase client
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service unavailable" },
      { status: 503 }
    );
  }

  try {
    // First, check if we have keyword data in public.keywords
    const normalizedTerm = term.trim().toLowerCase().replace(/\s+/g, " ");

    const { data: keywordData } = await supabase
      .from("keywords")
      .select(
        `
        id,
        term,
        market,
        demand_index,
        competition_score,
        engagement_score,
        ai_opportunity_score,
        extras
      `
      )
      .eq("market", normalizedMarket)
      .eq("term_normalized", normalizedTerm)
      .single();

    // If no keyword data, return no_data response
    if (!keywordData) {
      return NextResponse.json({
        keyword: term,
        status: "no_data",
        message: "No reliable data available for this keyword",
      });
    }

    // Determine which LexyBrain capability to use
    // Default to "radar" for keyword-level insights
    const lexyBrainType = capability === "market_brief" ? "market_brief" : "radar";

    // Build context for LexyBrain
    const context_data: any = {
      market: normalizedMarket,
      niche_terms: [keywordData.term],
    };

    // Check cache first
    const crypto = await import("crypto");
    const inputHash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ type: lexyBrainType, context: context_data }))
      .digest("hex");

    let cachedResult = null;
    const { data: cacheData } = await supabase
      .from("ai_insights")
      .select("output_json")
      .eq("type", lexyBrainType)
      .eq("input_hash", inputHash)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cacheData) {
      cachedResult = cacheData.output_json;
    }

    // Check quota before generating (only if not cached)
    const quotaKey = lexyBrainType === "market_brief" ? "ai_brief" : "ai_calls";
    const quotaCheck = await consumeLexyBrainQuota(
      context.userId,
      quotaKey,
      cachedResult ? 0 : 1
    );

    if (!quotaCheck.allowed && !cachedResult) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          used: quotaCheck.used,
          limit: quotaCheck.limit,
          upgrade_url: `${
            process.env.NEXT_PUBLIC_APP_URL || "https://app.lexyhub.com"
          }/billing`,
        },
        { status: 402 } // Payment Required
      );
    }

    let lexyBrainOutput;
    if (cachedResult) {
      lexyBrainOutput = cachedResult;
    } else {
      // Generate LexyBrain insight
      const insight = await generateLexyBrainJson({
        type: lexyBrainType,
        context: context_data,
        userId: context.userId,
      });
      lexyBrainOutput = insight.output;
    }

    // Transform LexyBrain output to extension-friendly format
    let response: any = {
      keyword: keywordData.term,
      status: "success",
    };

    // Add metrics from keyword data
    response.metrics = {};
    if (keywordData.demand_index !== null) {
      response.metrics.demand = Number(keywordData.demand_index);
    }
    if (keywordData.competition_score !== null) {
      response.metrics.competition = Number(keywordData.competition_score);
    }
    if (keywordData.ai_opportunity_score !== null) {
      response.metrics.ai_score = Number(keywordData.ai_opportunity_score);
    }

    // Extract extras
    const extras = (keywordData.extras as any) || {};
    if (extras.trend) {
      response.metrics.momentum = extras.trend;
    }
    if (extras.risk_level) {
      response.metrics.risk = extras.risk_level;
    }

    // Extract insights from LexyBrain output
    response.insights = [];

    if (lexyBrainType === "radar" && lexyBrainOutput.items) {
      // Find the item for our keyword
      const item = lexyBrainOutput.items.find(
        (i: any) => i.term.toLowerCase() === normalizedTerm
      );

      if (item) {
        // Add the comment as an insight
        response.insights.push(item.comment);

        // Add score-based insights
        if (item.scores) {
          if (item.scores.demand > 0.7) {
            response.insights.push("Strong demand detected in this market");
          }
          if (item.scores.competition < 0.4) {
            response.insights.push("Low competition presents opportunity");
          } else if (item.scores.competition > 0.7) {
            response.insights.push("High competition - consider differentiation");
          }
          if (item.scores.momentum > 0.6) {
            response.insights.push("Positive momentum trend");
          }
          if (item.scores.profit > 0.6) {
            response.insights.push("Good profit potential");
          }
        }
      }
    } else if (lexyBrainType === "market_brief" && lexyBrainOutput.summary) {
      // Use market brief summary
      response.insights.push(lexyBrainOutput.summary);

      // Add top opportunities
      if (lexyBrainOutput.top_opportunities) {
        const opp = lexyBrainOutput.top_opportunities.find(
          (o: any) => o.term.toLowerCase() === normalizedTerm
        );
        if (opp) {
          response.insights.push(opp.why);
        }
      }

      // Add risks
      if (lexyBrainOutput.risks && lexyBrainOutput.risks.length > 0) {
        const risk = lexyBrainOutput.risks.find(
          (r: any) => r.term.toLowerCase() === normalizedTerm
        );
        if (risk) {
          response.insights.push(`Risk: ${risk.why}`);
        }
      }
    }

    // Limit to 3 insights for extension display
    response.insights = response.insights.slice(0, 3);

    // If no insights generated, add a default
    if (response.insights.length === 0) {
      response.insights.push("Data available - check LexyHub for detailed analysis");
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Error in /api/ext/lexybrain/insights:", error);

    return NextResponse.json(
      {
        error: "Failed to generate insights",
        message: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const maxDuration = 20; // 20 second timeout for AI generation
