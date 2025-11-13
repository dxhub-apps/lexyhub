// src/app/api/ext/account/route.ts
import { NextResponse } from "next/server";
import { authenticateExtension, checkRateLimit } from "@/lib/extension/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getPlanConfig, isValidPlanCode } from "@/lib/billing/plans";
import type { PlanCode } from "@/lib/billing/types";
import { getUserUsageStats } from "@/lib/billing/usage";

export async function GET(request: Request): Promise<NextResponse> {
  const context = await authenticateExtension(request);
  if (!context) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!checkRateLimit(context.userId, 120, 60_000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select(
        "plan, full_name, avatar_url, company, extension_trial_activated_at, extension_trial_expires_at"
      )
      .eq("user_id", context.userId)
      .maybeSingle();

    if (profileError) {
      console.error("[ext/account] Failed to load profile", profileError);
    }

    const planCodeRaw = profile?.plan || "free";
    const planCode: PlanCode = (isValidPlanCode(planCodeRaw) ? planCodeRaw : "free") as PlanCode;
    const planConfig = getPlanConfig(planCode);
    const usage = await getUserUsageStats(context.userId);

    const { count: watchlistCount } = await supabase
      .from("user_watchlist_terms")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId);

    const watchlistUsed = watchlistCount ?? 0;
    const watchlistLimit = planConfig.niches_max;
    const watchlistPercentage =
      watchlistLimit === -1
        ? 0
        : watchlistLimit === 0
        ? 100
        : Math.min(100, Math.round((watchlistUsed / watchlistLimit) * 100));

    const trialActive = Boolean(
      profile?.extension_trial_expires_at && new Date(profile.extension_trial_expires_at) > new Date()
    );

    return NextResponse.json({
      success: true,
      user: {
        id: context.userId,
        name: profile?.full_name || null,
        company: profile?.company || null,
        avatar_url: profile?.avatar_url || null,
      },
      plan: {
        code: planCode,
        display_name: planConfig.display_name,
        features: planConfig.features,
        niches_max: planConfig.niches_max,
        searches_per_month: planConfig.searches_per_month,
        ai_opportunities_per_month: planConfig.ai_opportunities_per_month,
        is_trial: trialActive,
        trial_expires_at: profile?.extension_trial_expires_at,
        trial_started_at: profile?.extension_trial_activated_at,
        upgrade_url: buildUpgradeUrl(planCode),
      },
      usage: {
        searches: usage.searches,
        ai_opportunities: usage.ai_opportunities,
        watchlist: {
          key: "niches",
          used: watchlistUsed,
          limit: watchlistLimit,
          percentage: watchlistPercentage,
          shouldWarn:
            watchlistLimit !== -1 && watchlistPercentage >= 80 && watchlistPercentage < 100,
          warningLevel:
            watchlistLimit === -1
              ? "none"
              : watchlistPercentage >= 100
              ? "blocked"
              : watchlistPercentage >= 90
              ? "critical"
              : watchlistPercentage >= 80
              ? "warning"
              : "none",
        },
      },
    });
  } catch (error) {
    console.error("Unexpected error in /api/ext/account:", error);
    return NextResponse.json({ error: "Failed to fetch account" }, { status: 500 });
  }
}

function buildUpgradeUrl(planCode: PlanCode): string {
  const target = planCode === "growth" ? "growth" : planCode === "pro" ? "growth" : planCode === "basic" ? "pro" : "basic";
  return `https://app.lexyhub.com/pricing?from=extension&target=${target}`;
}

export const runtime = "nodejs";
