import { getSupabaseServerClient } from "@/lib/supabase-server";
import { shouldSendUsageWarning, recordUsageWarning, createUpsellTrigger } from "./usage";
import { USAGE_WARNING_THRESHOLDS } from "./plans";

// Legacy quota keys (for backwards compatibility)
export type LegacyQuotaKey = "searches" | "ai_opportunities" | "niches";

// New standardized quota keys per v1 scope
export type StandardQuotaKey = "ks" | "lb" | "br" | "wl";

// Union type supporting both legacy and new keys
export type QuotaKey = LegacyQuotaKey | StandardQuotaKey;

export type QuotaResult = {
  allowed: boolean;
  used: number;
  limit: number;
};

export class QuotaExceededError extends Error {
  public readonly used: number;
  public readonly limit: number;
  public readonly key: QuotaKey;

  constructor(key: QuotaKey, used: number, limit: number) {
    super(`Quota exceeded for ${key}: ${used}/${limit}`);
    this.name = "QuotaExceededError";
    this.key = key;
    this.used = used;
    this.limit = limit;
  }
}

/**
 * Normalize quota keys for RPC compatibility
 * Maps new standardized keys (ks, lb, br, wl) to RPC-compatible keys
 *
 * Key mapping:
 * - ks → ks (keyword searches) - RPC updated to support this
 * - lb → lb (LexyBrain/RAG) - RPC updated to support this
 * - br → br (briefs) - RPC updated to support this
 * - wl → wl (watchlist) - RPC updated to support this
 * - searches → searches (legacy)
 * - ai_opportunities → ai_opportunities (legacy)
 * - niches → niches (legacy)
 */
function normalizeQuotaKey(key: QuotaKey): string {
  // New keys pass through as-is (RPC function now supports them)
  // Legacy keys also pass through
  return key;
}

/**
 * Server-side quota enforcement using atomic RPC.
 * Checks monthly usage against plan entitlements.
 * Throws QuotaExceededError if limit reached.
 *
 * @param userId - User UUID
 * @param key - Quota key: 'ks' (keyword search), 'lb' (LexyBrain), 'br' (briefs), 'wl' (watchlist)
 *               Legacy keys also supported: 'searches', 'ai_opportunities', 'niches'
 * @param amount - Amount to increment (default 1)
 * @returns QuotaResult with allowed, used, limit
 */
export async function useQuota(
  userId: string,
  key: QuotaKey,
  amount: number = 1,
): Promise<QuotaResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  const normalizedKey = normalizeQuotaKey(key);

  const { data, error } = await supabase.rpc("use_quota", {
    p_user: userId,
    p_key: normalizedKey,
    p_amount: amount,
  });

  if (error) {
    console.error("Quota RPC error", error);
    throw new Error(`Failed to check quota: ${error.message}`);
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("Quota RPC returned no data");
  }

  if (!row.allowed) {
    // Create upsell trigger when quota exceeded
    createUpsellTrigger(userId, 'quota_exceeded', 'growth', {
      quota_key: key,
      used: row.used,
      limit: row.limit,
    }).catch((error) => {
      console.warn("Failed to create upsell trigger", error);
    });

    throw new QuotaExceededError(key, row.used, row.limit);
  }

  // Check if we should send usage warnings (async, non-blocking)
  if (row.limit !== -1) {
    const percentage = (row.used / row.limit) * 100;

    // Check critical threshold (90%)
    if (percentage >= USAGE_WARNING_THRESHOLDS.CRITICAL) {
      shouldSendUsageWarning(userId, key, USAGE_WARNING_THRESHOLDS.CRITICAL, row.used, row.limit)
        .then((check) => {
          if (check.shouldNotify) {
            recordUsageWarning(userId, key, USAGE_WARNING_THRESHOLDS.CRITICAL, row.used, row.limit);
            // TODO: Send email notification
            console.log(`CRITICAL usage warning for user ${userId}: ${key} at ${percentage}%`);
          }
        })
        .catch((error) => {
          console.warn("Failed to check/record critical usage warning", error);
        });
    }

    // Check warning threshold (80%)
    if (percentage >= USAGE_WARNING_THRESHOLDS.WARNING) {
      shouldSendUsageWarning(userId, key, USAGE_WARNING_THRESHOLDS.WARNING, row.used, row.limit)
        .then((check) => {
          if (check.shouldNotify) {
            recordUsageWarning(userId, key, USAGE_WARNING_THRESHOLDS.WARNING, row.used, row.limit);
            // TODO: Send email notification
            console.log(`Usage warning for user ${userId}: ${key} at ${percentage}%`);
          }
        })
        .catch((error) => {
          console.warn("Failed to check/record usage warning", error);
        });
    }
  }

  return {
    allowed: row.allowed,
    used: row.used,
    limit: row.limit,
  };
}

/**
 * Get current usage for a user without incrementing.
 * Useful for displaying usage in UI.
 *
 * @param userId - User UUID
 * @returns Map of quota keys to {used, limit}
 */
export async function getCurrentUsage(
  userId: string,
): Promise<Record<QuotaKey, { used: number; limit: number }>> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error("Supabase client unavailable");
  }

  // Get user plan
  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  const plan = profileData?.plan ?? "free";

  // Get entitlements
  const { data: entData } = await supabase
    .from("plan_entitlements")
    .select("searches_per_month, ai_opportunities_per_month, niches_max")
    .eq("plan_code", plan)
    .maybeSingle();

  const entitlements = entData ?? {
    searches_per_month: 10,
    ai_opportunities_per_month: 2,
    niches_max: 1,
  };

  // Get current period usage
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data: usageData } = await supabase
    .from("usage_counters")
    .select("key, value")
    .eq("user_id", userId)
    .eq("period_start", periodStart.toISOString().split("T")[0]);

  const usageMap: Record<string, number> = {};
  (usageData ?? []).forEach((row: { key: string; value: number }) => {
    usageMap[row.key] = row.value;
  });

  return {
    searches: {
      used: usageMap["searches"] ?? 0,
      limit: entitlements.searches_per_month,
    },
    ai_opportunities: {
      used: usageMap["ai_opportunities"] ?? 0,
      limit: entitlements.ai_opportunities_per_month,
    },
    niches: {
      used: usageMap["niches"] ?? 0,
      limit: entitlements.niches_max,
    },
  };
}
