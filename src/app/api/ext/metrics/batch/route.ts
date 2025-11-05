// src/app/api/ext/metrics/batch/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface MetricsBatchPayload {
  terms: string[];
  market: string;
}

interface KeywordMetrics {
  t: string;  // term
  demand: number;
  competition: number;
  engagement: number;
  ai_score: number;
  trend: "up" | "down" | "flat" | "unknown";
  freshness: string;
  intent?: string;
  seasonality?: string;
}

/**
 * Convert numeric trend_momentum to arrow indicator
 */
function getTrendIndicator(trendMomentum: number | null): "up" | "down" | "flat" | "unknown" {
  if (trendMomentum === null || trendMomentum === undefined) {
    return "unknown";
  }

  if (trendMomentum > 0.6) return "up";
  if (trendMomentum < 0.4) return "down";
  return "flat";
}

/**
 * Format timestamp as relative time
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return "unknown";

  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
}

/**
 * Normalize metric to [0, 100] scale for display
 */
function normalizeMetric(value: number | null | undefined, fallback = 50): number {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;

  // If already in [0, 1], scale to [0, 100]
  if (numeric >= 0 && numeric <= 1) {
    return Math.round(numeric * 100);
  }

  // If already in [0, 100], return as is
  if (numeric >= 0 && numeric <= 100) {
    return Math.round(numeric);
  }

  // Otherwise, clamp to [0, 100]
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

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
  if (!checkRateLimit(context.userId, 200, 60000)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // Parse payload
  let payload: MetricsBatchPayload;
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
  if (!Array.isArray(terms) || terms.length === 0) {
    return NextResponse.json(
      { error: "terms array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (terms.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 terms per batch" },
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
    // Normalize terms for lookup
    const normalizedTerms = terms.map((t) =>
      t.toLowerCase().trim().replace(/\s+/g, " ")
    );

    // Fetch metrics from keywords table
    const { data, error } = await supabase
      .from("keywords")
      .select(
        "term, term_normalized, demand_index, competition_score, engagement_score, ai_opportunity_score, trend_momentum, freshness_ts, extras"
      )
      .eq("market", market.toLowerCase())
      .in("term_normalized", normalizedTerms);

    if (error) {
      console.error("Error fetching keyword metrics:", error);
      return NextResponse.json(
        { error: "Failed to fetch metrics" },
        { status: 500 }
      );
    }

    // Build response metrics
    const metrics: KeywordMetrics[] = [];
    const dataMap = new Map(
      (data || []).map((row) => [row.term_normalized, row])
    );

    for (let i = 0; i < terms.length; i++) {
      const originalTerm = terms[i];
      const normalizedTerm = normalizedTerms[i];
      const row = dataMap.get(normalizedTerm);

      if (row) {
        const extras = row.extras || {};
        metrics.push({
          t: originalTerm,
          demand: normalizeMetric(row.demand_index, 50),
          competition: normalizeMetric(row.competition_score, 50),
          engagement: normalizeMetric(row.engagement_score, 50),
          ai_score: normalizeMetric(row.ai_opportunity_score, 50),
          trend: getTrendIndicator(row.trend_momentum),
          freshness: formatRelativeTime(row.freshness_ts),
          intent: extras.intent || undefined,
          seasonality: extras.seasonality || undefined,
        });
      } else {
        // Term not found in golden source yet
        metrics.push({
          t: originalTerm,
          demand: 0,
          competition: 0,
          engagement: 0,
          ai_score: 0,
          trend: "unknown",
          freshness: "unknown",
        });
      }
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Unexpected error in /api/ext/metrics/batch:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
