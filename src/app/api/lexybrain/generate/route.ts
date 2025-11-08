/**
 * LexyBrain Generate API Endpoint
 *
 * Main orchestrator for LexyBrain AI insights generation.
 * Handles caching, quota enforcement, model calls, and analytics.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createHash } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { isLexyBrainEnabled, getLexyBrainTtl, getLexyBrainDailyCostCap, getEstimatedCost } from "@/lib/lexybrain-config";
import { generateLexyBrainJson } from "@/lib/lexybrain-json";
import { getQuotaKeyForType, consumeLexyBrainQuota, isDailyCostCapReached, LexyBrainQuotaExceededError } from "@/lib/lexybrain-quota";
import type { LexyBrainOutputType } from "@/lib/lexybrain-schemas";
import type { LexyBrainContext } from "@/lib/lexybrain-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max for Vercel

// =====================================================
// Request/Response Types
// =====================================================

const GenerateRequestSchema = z.object({
  type: z.enum(["market_brief", "radar", "ad_insight", "risk"]),
  market: z.string().min(1),
  niche_terms: z.array(z.string()).optional().default([]),
  budget_cents: z.number().int().positive().optional(),
});

type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

// =====================================================
// Main Endpoint
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  let userId: string | null = null;
  let requestData: GenerateRequest | null = null;

  try {
    // 1. Feature Flag Check
    if (!isLexyBrainEnabled()) {
      logger.warn({ type: "lexybrain_disabled" }, "LexyBrain request rejected: feature disabled");
      return NextResponse.json(
        { error: "lexybrain_disabled", message: "LexyBrain is not currently enabled" },
        { status: 503 }
      );
    }

    // 2. Authentication
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.warn({ type: "lexybrain_unauthorized" }, "LexyBrain request without authentication");
      return NextResponse.json(
        { error: "unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    userId = user.id;

    // 3. Parse and Validate Request
    const body = await request.json().catch(() => null);
    const parsed = GenerateRequestSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn(
        { type: "lexybrain_invalid_request", errors: parsed.error.errors },
        "Invalid LexyBrain request"
      );
      return NextResponse.json(
        { error: "invalid_request", details: parsed.error.errors },
        { status: 422 }
      );
    }

    requestData = parsed.data;
    const { type, market, niche_terms, budget_cents } = requestData;

    // 4. Normalize Input
    const normalizedNicheTerms = niche_terms
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length > 0)
      .filter((t, idx, arr) => arr.indexOf(t) === idx); // dedupe

    // 5. Build Context
    const context = await buildContext(type, market, normalizedNicheTerms, budget_cents);

    // 6. Compute Input Hash (for caching)
    const inputHash = computeInputHash(type, market, normalizedNicheTerms, budget_cents, context);

    logger.debug(
      {
        type: "lexybrain_request",
        insight_type: type,
        user_id: userId,
        market,
        niche_terms_count: normalizedNicheTerms.length,
        keywords_count: context.keywords.length,
        input_hash: inputHash,
      },
      "Processing LexyBrain request"
    );

    // 7. Check Cache
    const cachedInsight = await checkCache(type, inputHash);

    if (cachedInsight) {
      // Cache hit - record usage event
      await recordUsageEvent(userId, type, {
        cache_hit: true,
        latency_ms: Date.now() - startTime,
      });

      // Track analytics
      trackPostHog(userId, type, { cache_hit: true, market });

      logger.info(
        {
          type: "lexybrain_cache_hit",
          insight_type: type,
          user_id: userId,
          input_hash: inputHash,
        },
        "LexyBrain cache hit"
      );

      return NextResponse.json(cachedInsight.output_json);
    }

    // 8. Quota Check
    const quotaKey = getQuotaKeyForType(type);

    try {
      await consumeLexyBrainQuota(userId, quotaKey, 1);
    } catch (error) {
      if (error instanceof LexyBrainQuotaExceededError) {
        logger.warn(
          {
            type: "lexybrain_quota_exceeded",
            user_id: userId,
            quota_key: quotaKey,
            used: error.used,
            limit: error.limit,
          },
          "LexyBrain quota exceeded"
        );

        return NextResponse.json(
          {
            error: "quota_exceeded",
            message: error.message,
            used: error.used,
            limit: error.limit,
          },
          { status: 429 }
        );
      }
      throw error;
    }

    // 9. Daily Cost Cap Check
    const dailyCostCap = getLexyBrainDailyCostCap();
    const costCapReached = await isDailyCostCapReached(dailyCostCap);

    if (costCapReached) {
      logger.warn(
        { type: "lexybrain_cost_cap_reached", daily_cap_cents: dailyCostCap },
        "Daily cost cap reached, rejecting new request"
      );

      return NextResponse.json(
        {
          error: "cost_cap_reached",
          message: "Daily AI cost limit reached. Please try again tomorrow or use cached results.",
        },
        { status: 503 }
      );
    }

    // 10. Load Prompt Config
    const promptConfig = await loadActivePromptConfig(type);

    // 11. Generate AI Insight
    const result = await generateLexyBrainJson({
      type,
      context,
      userId,
      promptConfig,
    });

    // 12. Persist to Cache
    const ttlMinutes = getLexyBrainTtl(type);
    await persistInsight(type, inputHash, userId, context, result.output, ttlMinutes);

    // 13. Record Usage Event
    const estimatedCostCents = getEstimatedCost(type);
    await recordUsageEvent(userId, type, {
      cache_hit: false,
      latency_ms: result.metadata.latencyMs,
      tokens_in: result.metadata.promptTokens,
      tokens_out: result.metadata.outputTokens,
      cost_cents: estimatedCostCents,
      model_version: result.metadata.modelVersion,
    });

    // 14. Track Analytics
    trackPostHog(userId, type, {
      cache_hit: false,
      latency_ms: result.metadata.latencyMs,
      market,
    });

    logger.info(
      {
        type: "lexybrain_success",
        insight_type: type,
        user_id: userId,
        latency_ms: result.metadata.latencyMs,
        cache_hit: false,
      },
      "LexyBrain generation successful"
    );

    // 15. Create Notification for High-Severity RiskSentinel Alerts
    if (type === "risk") {
      // Import notification helper dynamically to avoid circular dependencies
      const { createRiskSentinelNotification } = await import("@/lib/lexybrain-notifications");

      // Type-cast output as RiskSentinel
      const riskOutput = result.output as { alerts: Array<{ term: string; issue: string; severity: "low" | "medium" | "high"; evidence: string; action: string }> };

      // Create notification (fire and forget - don't block response)
      createRiskSentinelNotification(
        userId,
        market,
        normalizedNicheTerms,
        riskOutput.alerts
      ).catch((error) => {
        logger.warn(
          {
            type: "lexybrain_notification_failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to create RiskSentinel notification"
        );
      });
    }

    // 16. Return Result with Metadata
    return NextResponse.json({
      ...result.output,
      _metadata: {
        responseId: result.metadata.responseId,
        requestId: result.metadata.requestId,
        latencyMs: result.metadata.latencyMs,
        modelVersion: result.metadata.modelVersion,
      },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    logger.error(
      {
        type: "lexybrain_error",
        insight_type: requestData?.type,
        user_id: userId,
        latency_ms: latencyMs,
        error: error instanceof Error ? error.message : String(error),
      },
      "LexyBrain generation failed"
    );

    // Capture in Sentry
    Sentry.captureException(error, {
      tags: {
        feature: "lexybrain",
        component: "generate-endpoint",
        insight_type: requestData?.type || "unknown",
      },
      extra: {
        user_id: userId,
        request_data: requestData,
        latency_ms: latencyMs,
      },
    });

    return NextResponse.json(
      {
        error: "generation_failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Build context data for the given type and parameters
 */
async function buildContext(
  type: LexyBrainOutputType,
  market: string,
  nicheTerms: string[],
  budgetCents?: number
): Promise<LexyBrainContext> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  // Fetch relevant keywords from niche_context RPC or directly from keywords table
  let keywords: Array<{
    term: string;
    demand_index?: number | null;
    competition_score?: number | null;
    trend_momentum?: number | null;
    engagement_score?: number | null;
    ai_opportunity_score?: number | null;
  }> = [];

  if (nicheTerms.length > 0) {
    // Use niche_context RPC if available
    const { data, error } = await supabase.rpc("niche_context", {
      p_terms: nicheTerms,
      p_market: market,
      p_limit: 50,
    });

    if (!error && data) {
      keywords = data;
    }
  }

  // If no keywords from niche, fetch general market keywords
  if (keywords.length === 0) {
    const { data, error } = await supabase
      .from("keywords")
      .select("term, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score")
      .eq("market", market)
      .order("ai_opportunity_score", { ascending: false, nullsFirst: false })
      .limit(50);

    if (!error && data) {
      keywords = data;
    }
  }

  // Build context based on type
  const baseContext = {
    market,
    niche_terms: nicheTerms,
    keywords,
    metadata: {
      generated_at: new Date().toISOString(),
    },
  };

  if (type === "ad_insight" && budgetCents) {
    return { ...baseContext, budget_cents: budgetCents };
  }

  return baseContext;
}

/**
 * Compute deterministic hash for caching
 */
function computeInputHash(
  type: string,
  market: string,
  nicheTerms: string[],
  budgetCents: number | undefined,
  context: LexyBrainContext
): string {
  // Create deterministic string representation
  const components = [
    type,
    market.toLowerCase(),
    nicheTerms.sort().join(","),
    budgetCents || 0,
    // Include hash of keyword IDs to detect data changes
    context.keywords
      .map((k) => k.term)
      .sort()
      .join(","),
  ];

  const hashInput = components.join("|");
  return createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Check cache for existing insight
 */
async function checkCache(type: string, inputHash: string) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("ai_insights")
    .select("output_json, expires_at")
    .eq("type", type)
    .eq("input_hash", inputHash)
    .eq("status", "ready")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data;
}

/**
 * Persist generated insight to cache
 */
async function persistInsight(
  type: string,
  inputHash: string,
  userId: string,
  context: LexyBrainContext,
  output: unknown,
  ttlMinutes: number
) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn("Cannot persist insight: Supabase unavailable");
    return;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await supabase.from("ai_insights").upsert(
    {
      type,
      input_hash: inputHash,
      user_id: userId,
      context_json: context,
      output_json: output,
      generated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      ttl_minutes: ttlMinutes,
      status: "ready",
    },
    {
      onConflict: "type,input_hash",
    }
  );
}

/**
 * Record AI usage event
 */
async function recordUsageEvent(
  userId: string,
  type: string,
  metadata: {
    cache_hit: boolean;
    latency_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    cost_cents?: number;
    model_version?: string;
  }
) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn("Cannot record usage event: Supabase unavailable");
    return;
  }

  // Get user plan
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  await supabase.from("ai_usage_events").insert({
    user_id: userId,
    type,
    tokens_in: metadata.tokens_in,
    tokens_out: metadata.tokens_out,
    cache_hit: metadata.cache_hit,
    latency_ms: metadata.latency_ms,
    cost_cents: metadata.cost_cents,
    model_version: metadata.model_version,
    plan_code: profileData?.plan || "free",
    ts: new Date().toISOString(),
  });
}

/**
 * Load active prompt config from database
 */
async function loadActivePromptConfig(type: LexyBrainOutputType) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return undefined;
  }

  // Load global config + type-specific config
  const { data: configs } = await supabase
    .from("lexybrain_prompt_configs")
    .select("type, system_instructions, constraints")
    .eq("is_active", true)
    .in("type", ["global", type]);

  if (!configs || configs.length === 0) {
    return undefined;
  }

  // Merge global + type-specific
  const globalConfig = configs.find((c) => c.type === "global");
  const typeConfig = configs.find((c) => c.type === type);

  if (typeConfig) {
    return {
      system_instructions: typeConfig.system_instructions,
      constraints: typeConfig.constraints as Record<string, unknown>,
    };
  }

  if (globalConfig) {
    return {
      system_instructions: globalConfig.system_instructions,
      constraints: globalConfig.constraints as Record<string, unknown>,
    };
  }

  return undefined;
}

/**
 * Track event in PostHog (fire and forget)
 */
function trackPostHog(
  userId: string,
  type: string,
  properties: Record<string, unknown>
) {
  // PostHog tracking would be done client-side or via PostHog server SDK
  // For now, just log
  logger.debug(
    {
      type: "posthog_event",
      event_name: "lexybrain_generate",
      user_id: userId,
      insight_type: type,
      properties,
    },
    "PostHog event tracked"
  );
}
