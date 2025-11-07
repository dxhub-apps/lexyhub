/**
 * Admin API: LexyBrain Usage Metrics
 *
 * Provides analytics and metrics for LexyBrain usage.
 * Includes cache hit rates, error rates, latency stats, and cost tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { requireAdminUser } from "@/lib/backoffice/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =====================================================
// GET - Get LexyBrain usage metrics
// =====================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require admin access
    await requireAdminUser();

    const supabase = getSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase client unavailable" },
        { status: 503 }
      );
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period") || "7d"; // 7d, 30d, 90d
    const type = searchParams.get("type"); // Optional filter by type

    // Calculate date range
    const now = new Date();
    const daysAgo = period === "30d" ? 30 : period === "90d" ? 90 : 7;
    const since = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Build query
    let query = supabase
      .from("ai_usage_events")
      .select("*")
      .gte("ts", since.toISOString());

    if (type) {
      query = query.eq("type", type);
    }

    const { data: usageEvents, error } = await query;

    if (error) {
      logger.error(
        { type: "admin_lexybrain_metrics_error", error: error.message },
        "Failed to fetch usage metrics"
      );
      return NextResponse.json(
        { error: "Failed to fetch metrics", details: error.message },
        { status: 500 }
      );
    }

    // Calculate metrics
    const metrics = calculateMetrics(usageEvents || []);

    // Get failure count
    const { count: failureCount } = await supabase
      .from("ai_failures")
      .select("*", { count: "exact", head: true })
      .gte("ts", since.toISOString());

    // Get active cache entries
    const { count: cacheCount } = await supabase
      .from("ai_insights")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready")
      .gte("expires_at", now.toISOString());

    return NextResponse.json({
      period,
      since: since.toISOString(),
      metrics: {
        ...metrics,
        failures: failureCount || 0,
        active_cache_entries: cacheCount || 0,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Admin access required")) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    logger.error(
      { type: "admin_lexybrain_metrics_exception", error: error instanceof Error ? error.message : String(error) },
      "Exception fetching metrics"
    );

    Sentry.captureException(error, {
      tags: { feature: "lexybrain", component: "admin-metrics" },
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// =====================================================
// Helper Functions
// =====================================================

function calculateMetrics(events: any[]) {
  if (events.length === 0) {
    return {
      total_requests: 0,
      cache_hits: 0,
      cache_misses: 0,
      cache_hit_rate: 0,
      avg_latency_ms: 0,
      p95_latency_ms: 0,
      total_tokens_in: 0,
      total_tokens_out: 0,
      total_cost_cents: 0,
      by_type: {},
      by_plan: {},
    };
  }

  const totalRequests = events.length;
  const cacheHits = events.filter((e) => e.cache_hit).length;
  const cacheMisses = totalRequests - cacheHits;
  const cacheHitRate = (cacheHits / totalRequests) * 100;

  const latencies = events
    .filter((e) => e.latency_ms)
    .map((e) => e.latency_ms)
    .sort((a, b) => a - b);

  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
      : 0;

  const p95Index = Math.floor(latencies.length * 0.95);
  const p95LatencyMs = latencies[p95Index] || 0;

  const totalTokensIn = events.reduce((sum, e) => sum + (e.tokens_in || 0), 0);
  const totalTokensOut = events.reduce((sum, e) => sum + (e.tokens_out || 0), 0);
  const totalCostCents = events.reduce((sum, e) => sum + (e.cost_cents || 0), 0);

  // Group by type
  const byType: Record<string, { count: number; cache_hit_rate: number }> = {};
  for (const event of events) {
    if (!byType[event.type]) {
      byType[event.type] = { count: 0, cache_hit_rate: 0 };
    }
    byType[event.type].count++;
  }

  for (const type in byType) {
    const typeEvents = events.filter((e) => e.type === type);
    const typeHits = typeEvents.filter((e) => e.cache_hit).length;
    byType[type].cache_hit_rate = (typeHits / typeEvents.length) * 100;
  }

  // Group by plan
  const byPlan: Record<string, { count: number; cache_hit_rate: number }> = {};
  for (const event of events) {
    const plan = event.plan_code || "unknown";
    if (!byPlan[plan]) {
      byPlan[plan] = { count: 0, cache_hit_rate: 0 };
    }
    byPlan[plan].count++;
  }

  for (const plan in byPlan) {
    const planEvents = events.filter((e) => (e.plan_code || "unknown") === plan);
    const planHits = planEvents.filter((e) => e.cache_hit).length;
    byPlan[plan].cache_hit_rate = (planHits / planEvents.length) * 100;
  }

  return {
    total_requests: totalRequests,
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    cache_hit_rate: parseFloat(cacheHitRate.toFixed(2)),
    avg_latency_ms: Math.round(avgLatencyMs),
    p95_latency_ms: p95LatencyMs,
    total_tokens_in: totalTokensIn,
    total_tokens_out: totalTokensOut,
    total_cost_cents: totalCostCents,
    by_type: byType,
    by_plan: byPlan,
  };
}
