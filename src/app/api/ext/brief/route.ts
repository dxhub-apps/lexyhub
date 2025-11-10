// src/app/api/ext/brief/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { enforceQuota, QuotaExceededError } from "@/lib/billing/enforce";

interface BriefPayload {
  terms: string[];
  market: string;
}

/**
 * Brief entity table schema (simplified):
 * - id: uuid
 * - user_id: uuid
 * - title: text
 * - market: text
 * - terms: jsonb
 * - created_at: timestamptz
 *
 * Note: This assumes a 'briefs' table exists. If not, we'll need to create it.
 * For now, I'll create a simple JSON structure and store it in a generic way.
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

  // Rate limit
  if (!checkRateLimit(context.userId, 50, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Enforce brief quota (BR)
  try {
    await enforceQuota(context.userId, "br", 1);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: "Quota exceeded",
          code: "quota_exceeded",
          quota_key: "br",
          used: error.used,
          limit: error.limit,
          message: `You've reached your monthly brief limit (${error.limit} briefs). Upgrade your plan for more briefs.`,
        },
        { status: 402 }
      );
    }
    // Re-throw other errors
    throw error;
  }

  // Parse payload
  let payload: BriefPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { terms, market } = payload;

  // Validate
  if (!Array.isArray(terms) || terms.length < 2 || terms.length > 5) {
    return NextResponse.json(
      { error: "terms must be an array with 2-5 items" },
      { status: 400 }
    );
  }

  if (!market || !market.trim()) {
    return NextResponse.json(
      { error: "market is required" },
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
    // Generate brief title from terms
    const briefTitle = `${terms.slice(0, 2).join(", ")}${terms.length > 2 ? "..." : ""}`;

    // Fetch keyword data for clustering
    const normalizedTerms = terms.map(t => t.toLowerCase().trim().replace(/\s+/g, " "));

    const { data: keywordData, error: keywordError } = await supabase
      .from("keywords")
      .select("term, demand_index, competition_score, ai_opportunity_score, extras")
      .eq("market", market.toLowerCase())
      .in("term_normalized", normalizedTerms);

    if (keywordError) {
      console.error("Error fetching keyword data:", keywordError);
    }

    // Simple clustering by AI score
    const clusters: any = {
      high_opportunity: [],
      medium_opportunity: [],
      low_opportunity: [],
    };

    (keywordData || []).forEach((kw) => {
      const score = kw.ai_opportunity_score || 0;
      if (score >= 70) {
        clusters.high_opportunity.push(kw.term);
      } else if (score >= 40) {
        clusters.medium_opportunity.push(kw.term);
      } else {
        clusters.low_opportunity.push(kw.term);
      }
    });

    // Generate executive summary
    const executiveSummary = `Analysis of ${terms.length} keywords in ${market} market. ${clusters.high_opportunity.length} high-opportunity terms identified.`;

    // Generate opportunity analysis
    const opportunityAnalysis = {
      total_terms: terms.length,
      high_opportunity_count: clusters.high_opportunity.length,
      avg_demand: (keywordData?.reduce((sum, kw) => sum + (kw.demand_index || 0), 0) ?? 0) / (keywordData?.length || 1),
      avg_competition: (keywordData?.reduce((sum, kw) => sum + (kw.competition_score || 0), 0) ?? 0) / (keywordData?.length || 1),
    };

    // Store brief in database
    const { data: brief, error: briefError } = await supabase
      .from("extension_briefs")
      .insert({
        user_id: context.userId,
        title: briefTitle,
        market: market.toLowerCase(),
        terms,
        clusters,
        executive_summary: executiveSummary,
        opportunity_analysis: opportunityAnalysis,
        ai_insights: `Focus on ${clusters.high_opportunity.length > 0 ? clusters.high_opportunity.join(", ") : "medium-opportunity terms"} for best results.`,
      })
      .select("id")
      .single();

    if (briefError) {
      console.error("Error creating brief:", briefError);
      return NextResponse.json(
        { error: "Failed to create brief" },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.lexyhub.com";
    const briefUrl = `${appUrl}/briefs/${brief.id}`;

    return NextResponse.json({
      brief_id: brief.id,
      url: briefUrl,
      summary: executiveSummary,
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/brief:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
