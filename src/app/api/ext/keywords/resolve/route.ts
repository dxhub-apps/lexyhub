// src/app/api/ext/keywords/resolve/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface ResolveKeywordsPayload {
  candidates: string[];
  marketplace: string;
  domain: string;
}

interface ResolvedKeyword {
  term: string;
  keyword_id: string;
  marketplace: string;
  metrics?: {
    demand?: number;
    competition?: number;
    trend?: string;
    ai_score?: number;
  };
}

/**
 * Keywords Resolution endpoint for Chrome Extension v4
 *
 * Matches candidate keywords against public.keywords database
 * Returns ONLY verified keywords with keyword_id
 *
 * This ensures the extension highlights only real, tracked keywords
 * and prevents local fuzzy/semantic matching
 *
 * Usage:
 * POST /api/ext/keywords/resolve
 * {
 *   "candidates": ["handmade jewelry", "silver rings", "random phrase"],
 *   "marketplace": "etsy",
 *   "domain": "www.etsy.com"
 * }
 *
 * Response:
 * {
 *   "resolved": [
 *     {
 *       "term": "handmade jewelry",
 *       "keyword_id": "uuid",
 *       "marketplace": "etsy",
 *       "metrics": { "demand": 0.85, "competition": 0.62, ... }
 *     }
 *   ],
 *   "count": 1
 * }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  // Rate limit: 100 requests per minute (generous for real-time highlighting)
  if (!checkRateLimit(context.userId, 100, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: ResolveKeywordsPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { candidates, marketplace, domain } = payload;

  // Validate
  if (!Array.isArray(candidates)) {
    return NextResponse.json(
      { error: "candidates must be an array" },
      { status: 400 }
    );
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      resolved: [],
      count: 0,
    });
  }

  if (candidates.length > 100) {
    return NextResponse.json(
      { error: "candidates array too large (max 100 items)" },
      { status: 400 }
    );
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
    // Normalize candidates using the same normalization function as the database
    const normalizedCandidates = candidates
      .map((c) => {
        if (typeof c !== "string") return null;
        const trimmed = c.trim();
        if (!trimmed) return null;
        // Apply same normalization: lowercase, trim, collapse whitespace
        return trimmed.toLowerCase().replace(/\s+/g, " ");
      })
      .filter((c): c is string => c !== null);

    if (normalizedCandidates.length === 0) {
      return NextResponse.json({
        resolved: [],
        count: 0,
      });
    }

    // Query public.keywords for matches
    // Use term_normalized column for efficient matching
    const { data: keywords, error } = await supabase
      .from("keywords")
      .select(
        `
        id,
        term,
        term_normalized,
        market,
        demand_index,
        competition_score,
        engagement_score,
        ai_opportunity_score,
        extras
      `
      )
      .eq("market", normalizedMarket)
      .in("term_normalized", normalizedCandidates)
      .limit(100);

    if (error) {
      console.error("Error querying keywords:", error);
      return NextResponse.json(
        { error: "Failed to resolve keywords" },
        { status: 500 }
      );
    }

    // Build response with verified keywords only
    const resolved: ResolvedKeyword[] = (keywords || []).map((kw) => {
      const result: ResolvedKeyword = {
        term: kw.term, // Original term from database
        keyword_id: kw.id,
        marketplace: kw.market,
      };

      // Include metrics if available
      const hasMetrics =
        kw.demand_index !== null ||
        kw.competition_score !== null ||
        kw.engagement_score !== null ||
        kw.ai_opportunity_score !== null;

      if (hasMetrics) {
        result.metrics = {};

        if (kw.demand_index !== null) {
          result.metrics.demand = Number(kw.demand_index);
        }
        if (kw.competition_score !== null) {
          result.metrics.competition = Number(kw.competition_score);
        }
        if (kw.ai_opportunity_score !== null) {
          result.metrics.ai_score = Number(kw.ai_opportunity_score);
        }

        // Extract trend from extras if available
        if (kw.extras && typeof kw.extras === "object") {
          const extras = kw.extras as any;
          if (extras.trend) {
            result.metrics.trend = extras.trend;
          }
        }
      }

      return result;
    });

    return NextResponse.json({
      resolved,
      count: resolved.length,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/keywords/resolve:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
