/**
 * LexyBrain Quota and Usage Helpers
 *
 * Manages quota enforcement and usage tracking for LexyBrain features.
 * Integrates with existing billing system and plan entitlements.
 */

import { getSupabaseServerClient } from "./supabase-server";
import { logger } from "./logger";
import type { LexyBrainOutputType } from "./lexybrain-schemas";

// =====================================================
// Types
// =====================================================

export type LexyBrainQuotaKey = "ai_calls" | "ai_brief" | "ai_sim";

export interface PlanEntitlements {
  plan_code: string;
  searches_per_month: number;
  ai_opportunities_per_month: number;
  niches_max: number;
  ai_calls_per_month: number;
  briefs_per_month: number;
  sims_per_month: number;
  extension_boost: Record<string, unknown>;
}

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  percentage: number;
}

export class LexyBrainQuotaExceededError extends Error {
  constructor(
    public key: LexyBrainQuotaKey,
    public used: number,
    public limit: number
  ) {
    super(
      `LexyBrain quota exceeded for ${key}: ${used}/${limit}. Upgrade your plan for more AI insights.`
    );
    this.name = "LexyBrainQuotaExceededError";
  }
}

// =====================================================
// Quota Key Mapping
// =====================================================

/**
 * Map insight type to quota key
 */
export function getQuotaKeyForType(type: LexyBrainOutputType): LexyBrainQuotaKey {
  switch (type) {
    case "market_brief":
      return "ai_brief";
    case "radar":
    case "ad_insight":
    case "risk":
      return "ai_calls";
    default:
      return "ai_calls";
  }
}

// =====================================================
// Plan Entitlements
// =====================================================

/**
 * Get plan entitlements for a user
 * Resolves plan via existing billing tables and joins with plan_entitlements
 */
export async function getPlanEntitlements(
  userId: string
): Promise<PlanEntitlements> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn("Supabase client unavailable for plan entitlements lookup");
    return getDefaultEntitlements("free");
  }

  try {
    // Get user's plan from user_profiles
    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) {
      logger.error(
        {
          type: "plan_lookup_error",
          user_id: userId,
          error: profileError.message,
        },
        "Failed to lookup user plan"
      );
      return getDefaultEntitlements("free");
    }

    const planCode = profileData?.plan || "free";

    // Get entitlements for plan
    const { data: entData, error: entError } = await supabase
      .from("plan_entitlements")
      .select("*")
      .eq("plan_code", planCode)
      .maybeSingle();

    if (entError || !entData) {
      logger.warn(
        {
          type: "entitlements_lookup_error",
          plan_code: planCode,
          error: entError?.message,
        },
        "Failed to lookup plan entitlements, using defaults"
      );
      return getDefaultEntitlements(planCode);
    }

    return entData as PlanEntitlements;
  } catch (error) {
    logger.error(
      {
        type: "get_plan_entitlements_error",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Exception getting plan entitlements"
    );
    return getDefaultEntitlements("free");
  }
}

/**
 * Get default entitlements for a plan (fallback)
 */
function getDefaultEntitlements(planCode: string): PlanEntitlements {
  const defaults: Record<string, PlanEntitlements> = {
    free: {
      plan_code: "free",
      searches_per_month: 10,
      ai_opportunities_per_month: 10,
      niches_max: 1,
      ai_calls_per_month: 20,
      briefs_per_month: 2,
      sims_per_month: 2,
      extension_boost: { ai_calls_multiplier: 2 },
    },
    basic: {
      plan_code: "basic",
      searches_per_month: 100,
      ai_opportunities_per_month: 100,
      niches_max: 10,
      ai_calls_per_month: 200,
      briefs_per_month: 20,
      sims_per_month: 20,
      extension_boost: {},
    },
    pro: {
      plan_code: "pro",
      searches_per_month: 500,
      ai_opportunities_per_month: 500,
      niches_max: 50,
      ai_calls_per_month: 2000,
      briefs_per_month: 100,
      sims_per_month: 200,
      extension_boost: {},
    },
    growth: {
      plan_code: "growth",
      searches_per_month: -1,
      ai_opportunities_per_month: -1,
      niches_max: -1,
      ai_calls_per_month: -1,
      briefs_per_month: -1,
      sims_per_month: -1,
      extension_boost: {},
    },
  };

  return defaults[planCode] || defaults["free"];
}

// =====================================================
// Quota Usage
// =====================================================

/**
 * Consume quota for LexyBrain operations (atomic)
 * Throws LexyBrainQuotaExceededError if quota is exceeded
 */
export async function consumeLexyBrainQuota(
  userId: string,
  key: LexyBrainQuotaKey,
  amount: number = 1
): Promise<QuotaCheckResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable for quota check");
  }

  // Get plan entitlements
  const entitlements = await getPlanEntitlements(userId);

  // Map quota key to entitlement field
  const limitFieldMap: Record<LexyBrainQuotaKey, keyof PlanEntitlements> = {
    ai_calls: "ai_calls_per_month",
    ai_brief: "briefs_per_month",
    ai_sim: "sims_per_month",
  };

  const limitField = limitFieldMap[key];
  const limit = entitlements[limitField] as number;

  // -1 means unlimited
  if (limit === -1) {
    return {
      allowed: true,
      used: 0,
      limit: -1,
      percentage: 0,
    };
  }

  // Get current period (first day of month)
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const periodStartStr = periodStart.toISOString().split("T")[0];

  // Get current usage
  const { data: usageData, error: usageError } = await supabase
    .from("usage_counters")
    .select("value")
    .eq("user_id", userId)
    .eq("period_start", periodStartStr)
    .eq("key", key)
    .maybeSingle();

  if (usageError) {
    logger.error(
      {
        type: "usage_lookup_error",
        user_id: userId,
        key,
        error: usageError.message,
      },
      "Failed to lookup usage"
    );
    throw new Error(`Failed to check usage: ${usageError.message}`);
  }

  const currentUsage = usageData?.value || 0;
  const newUsage = currentUsage + amount;

  // Check if quota would be exceeded
  if (newUsage > limit) {
    logger.warn(
      {
        type: "lexybrain_quota_exceeded",
        user_id: userId,
        key,
        used: newUsage,
        limit,
      },
      "LexyBrain quota exceeded"
    );

    throw new LexyBrainQuotaExceededError(key, newUsage, limit);
  }

  // Atomic upsert to increment usage
  const { error: upsertError } = await supabase
    .from("usage_counters")
    .upsert(
      {
        user_id: userId,
        period_start: periodStartStr,
        key,
        value: newUsage,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,period_start,key",
      }
    );

  if (upsertError) {
    logger.error(
      {
        type: "usage_increment_error",
        user_id: userId,
        key,
        error: upsertError.message,
      },
      "Failed to increment usage"
    );
    throw new Error(`Failed to increment usage: ${upsertError.message}`);
  }

  const percentage = (newUsage / limit) * 100;

  logger.debug(
    {
      type: "lexybrain_quota_used",
      user_id: userId,
      key,
      used: newUsage,
      limit,
      percentage: percentage.toFixed(1),
    },
    "LexyBrain quota consumed"
  );

  return {
    allowed: true,
    used: newUsage,
    limit,
    percentage,
  };
}

/**
 * Check quota without consuming it
 */
export async function checkLexyBrainQuota(
  userId: string,
  key: LexyBrainQuotaKey
): Promise<QuotaCheckResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase client unavailable for quota check");
  }

  const entitlements = await getPlanEntitlements(userId);

  const limitFieldMap: Record<LexyBrainQuotaKey, keyof PlanEntitlements> = {
    ai_calls: "ai_calls_per_month",
    ai_brief: "briefs_per_month",
    ai_sim: "sims_per_month",
  };

  const limitField = limitFieldMap[key];
  const limit = entitlements[limitField] as number;

  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1, percentage: 0 };
  }

  // Get current period
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const periodStartStr = periodStart.toISOString().split("T")[0];

  // Get current usage
  const { data: usageData } = await supabase
    .from("usage_counters")
    .select("value")
    .eq("user_id", userId)
    .eq("period_start", periodStartStr)
    .eq("key", key)
    .maybeSingle();

  const used = usageData?.value || 0;
  const percentage = (used / limit) * 100;

  return {
    allowed: used < limit,
    used,
    limit,
    percentage,
  };
}

/**
 * Get all LexyBrain quota usage for a user
 */
export async function getLexyBrainQuotaUsage(userId: string): Promise<
  Record<LexyBrainQuotaKey, QuotaCheckResult>
> {
  const [aiCalls, aiBrief, aiSim] = await Promise.all([
    checkLexyBrainQuota(userId, "ai_calls"),
    checkLexyBrainQuota(userId, "ai_brief"),
    checkLexyBrainQuota(userId, "ai_sim"),
  ]);

  return {
    ai_calls: aiCalls,
    ai_brief: aiBrief,
    ai_sim: aiSim,
  };
}

// =====================================================
// Cost Cap Enforcement
// =====================================================

/**
 * Check if daily cost cap has been reached
 * Returns true if we should block new (uncached) requests
 */
export async function isDailyCostCapReached(
  dailyCapCents: number | null
): Promise<boolean> {
  if (dailyCapCents === null) {
    return false; // No cap set
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    logger.warn("Supabase unavailable for cost cap check, allowing request");
    return false;
  }

  try {
    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // Sum cost_cents from ai_usage_events for today where cache_hit = false
    const { data, error } = await supabase
      .from("ai_usage_events")
      .select("cost_cents")
      .gte("ts", todayStr)
      .eq("cache_hit", false);

    if (error) {
      logger.error(
        { type: "cost_cap_check_error", error: error.message },
        "Failed to check daily cost cap"
      );
      return false; // Fail open
    }

    const totalCostCents = (data || []).reduce(
      (sum, row) => sum + (row.cost_cents || 0),
      0
    );

    const capReached = totalCostCents >= dailyCapCents;

    if (capReached) {
      logger.warn(
        {
          type: "daily_cost_cap_reached",
          total_cost_cents: totalCostCents,
          cap_cents: dailyCapCents,
        },
        "Daily LexyBrain cost cap reached"
      );
    }

    return capReached;
  } catch (error) {
    logger.error(
      {
        type: "cost_cap_check_exception",
        error: error instanceof Error ? error.message : String(error),
      },
      "Exception checking daily cost cap"
    );
    return false; // Fail open
  }
}
