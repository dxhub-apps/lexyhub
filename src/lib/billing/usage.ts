/**
 * Enhanced usage tracking with warnings and upsell triggers
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { QuotaKey, LegacyQuotaKey } from "./enforce";
import { USAGE_WARNING_THRESHOLDS } from "./plans";

export interface UsageStats {
  key: QuotaKey;
  used: number;
  limit: number;
  percentage: number;
  shouldWarn: boolean;
  warningLevel: 'none' | 'warning' | 'critical' | 'blocked';
}

export interface UsageWarningCheck {
  shouldNotify: boolean;
  threshold: number;
  alreadyWarned: boolean;
}

/**
 * Get comprehensive usage statistics for a user.
 * Returns legacy quota keys for backward compatibility.
 */
export async function getUserUsageStats(userId: string): Promise<Record<LegacyQuotaKey, UsageStats>> {
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
    ai_opportunities_per_month: 10,
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

  // Calculate stats for each quota type
  const calculateStats = (key: QuotaKey, used: number, limit: number): UsageStats => {
    const percentage = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));

    let warningLevel: 'none' | 'warning' | 'critical' | 'blocked' = 'none';
    if (limit !== -1) {
      if (percentage >= USAGE_WARNING_THRESHOLDS.BLOCKED) {
        warningLevel = 'blocked';
      } else if (percentage >= USAGE_WARNING_THRESHOLDS.CRITICAL) {
        warningLevel = 'critical';
      } else if (percentage >= USAGE_WARNING_THRESHOLDS.WARNING) {
        warningLevel = 'warning';
      }
    }

    return {
      key,
      used,
      limit,
      percentage,
      shouldWarn: warningLevel !== 'none',
      warningLevel,
    };
  };

  return {
    searches: calculateStats(
      'searches',
      usageMap['searches'] ?? 0,
      entitlements.searches_per_month
    ),
    ai_opportunities: calculateStats(
      'ai_opportunities',
      usageMap['ai_opportunities'] ?? 0,
      entitlements.ai_opportunities_per_month
    ),
    niches: calculateStats(
      'niches',
      usageMap['niches'] ?? 0,
      entitlements.niches_max
    ),
  };
}

/**
 * Check if user should be warned about usage and if they haven't been warned already
 */
export async function shouldSendUsageWarning(
  userId: string,
  quotaKey: QuotaKey,
  threshold: number,
  currentUsage: number,
  limit: number
): Promise<UsageWarningCheck> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { shouldNotify: false, threshold, alreadyWarned: false };
  }

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // Check if warning already sent for this period and threshold
  const { data: existingWarning } = await supabase
    .from("usage_warnings")
    .select("id")
    .eq("user_id", userId)
    .eq("quota_key", quotaKey)
    .eq("threshold_percent", threshold)
    .eq("period_start", periodStart.toISOString().split("T")[0])
    .maybeSingle();

  const alreadyWarned = !!existingWarning;
  const percentage = limit === -1 ? 0 : (currentUsage / limit) * 100;
  const shouldNotify = percentage >= threshold && !alreadyWarned;

  return { shouldNotify, threshold, alreadyWarned };
}

/**
 * Record that a usage warning was sent
 */
export async function recordUsageWarning(
  userId: string,
  quotaKey: QuotaKey,
  threshold: number,
  currentUsage: number,
  limit: number
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  await supabase.from("usage_warnings").insert({
    user_id: userId,
    quota_key: quotaKey,
    threshold_percent: threshold,
    period_start: periodStart.toISOString().split("T")[0],
    usage_at_warning: currentUsage,
    limit_at_warning: limit,
  });
}

/**
 * Create an upsell trigger when appropriate conditions are met
 */
export async function createUpsellTrigger(
  userId: string,
  triggerType: 'quota_exceeded' | 'feature_locked' | 'heavy_usage' | 'admin_offer',
  targetPlan: string = 'growth',
  context: Record<string, unknown> = {}
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase.from("upsell_triggers").insert({
    user_id: userId,
    trigger_type: triggerType,
    target_plan: targetPlan,
    trigger_context: context,
  });
}

/**
 * Check if user should see Growth plan upsell
 * Returns true if:
 * - User is on Pro plan
 * - User has hit limits multiple times this month
 * - User hasn't dismissed upsell recently
 */
export async function shouldShowGrowthUpsell(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return false;
  }

  // Get user plan
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();

  // Only show to Pro users
  if (profile?.plan !== 'pro') {
    return false;
  }

  // Check if user has dismissed upsell in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentDismissal } = await supabase
    .from("upsell_triggers")
    .select("id")
    .eq("user_id", userId)
    .eq("target_plan", "growth")
    .not("dismissed_at", "is", null)
    .gte("dismissed_at", sevenDaysAgo.toISOString())
    .limit(1)
    .maybeSingle();

  if (recentDismissal) {
    return false; // User dismissed recently, don't show again
  }

  // Check usage stats - if hitting 90%+ on any quota, show upsell
  const stats = await getUserUsageStats(userId);
  const highUsage = Object.values(stats).some(
    stat => stat.percentage >= 90 && stat.limit !== -1
  );

  return highUsage;
}

/**
 * Mark upsell trigger as shown
 */
export async function markUpsellShown(triggerId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase
    .from("upsell_triggers")
    .update({ shown_at: new Date().toISOString() })
    .eq("id", triggerId);
}

/**
 * Mark upsell trigger as clicked
 */
export async function markUpsellClicked(triggerId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase
    .from("upsell_triggers")
    .update({ clicked_at: new Date().toISOString() })
    .eq("id", triggerId);
}

/**
 * Mark upsell trigger as dismissed
 */
export async function markUpsellDismissed(triggerId: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return;
  }

  await supabase
    .from("upsell_triggers")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", triggerId);
}
