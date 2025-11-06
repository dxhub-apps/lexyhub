import { NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/backoffice/auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { PLAN_CONFIGS } from "@/lib/billing/plans";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    // Extension Trials Metrics
    const { data: trialData } = await supabase.rpc("get_extension_trial_metrics");
    const extensionTrials = trialData?.[0] || {
      total_activated: 0,
      currently_active: 0,
      expired: 0,
      never_activated: 0,
    };

    // Referral Rewards Metrics
    const { data: referralData } = await supabase.rpc("get_referral_rewards_metrics");
    const referralRewards = referralData?.[0] || {
      total_basic_rewards: 0,
      total_pro_rewards: 0,
      active_basic_rewards: 0,
      active_pro_rewards: 0,
      total_users_with_referrals: 0,
    };

    // Active Subscriptions by Tier
    const { data: subscriptionData } = await supabase
      .from("billing_subscriptions")
      .select("plan, status, current_period_end")
      .in("status", ["active", "trialing"]);

    const subscriptionsByTier: Record<string, number> = {};
    let mrrCents = 0;

    (subscriptionData || []).forEach((sub) => {
      const plan = sub.plan || "free";
      subscriptionsByTier[plan] = (subscriptionsByTier[plan] || 0) + 1;

      // Calculate MRR
      const planConfig = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];
      if (planConfig && sub.status === "active") {
        mrrCents += planConfig.price_monthly_cents;
      }
    });

    // User Growth Metrics
    const { count: totalUsers } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: newUsersLast30Days } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());

    // Top Usage Stats (aggregate across all users)
    const { data: usageData } = await supabase.rpc("get_aggregate_usage_stats");
    const usageStats = usageData?.[0] || {
      total_searches_this_month: 0,
      total_ai_ops_this_month: 0,
      total_niches_tracked: 0,
      avg_searches_per_user: 0,
    };

    // Conversion Funnel (Pricing Analytics)
    const { data: funnelData } = await supabase.rpc("get_pricing_conversion_funnel");
    const conversionFunnel = funnelData?.[0] || {
      page_views: 0,
      checkout_started: 0,
      checkout_completed: 0,
      conversion_rate: 0,
    };

    return NextResponse.json({
      extensionTrials: {
        totalActivated: extensionTrials.total_activated,
        currentlyActive: extensionTrials.currently_active,
        expired: extensionTrials.expired,
        neverActivated: extensionTrials.never_activated,
        activePercentage:
          extensionTrials.total_activated > 0
            ? Math.round((extensionTrials.currently_active / extensionTrials.total_activated) * 100)
            : 0,
      },
      referralRewards: {
        totalBasic: referralRewards.total_basic_rewards,
        totalPro: referralRewards.total_pro_rewards,
        activeBasic: referralRewards.active_basic_rewards,
        activePro: referralRewards.active_pro_rewards,
        totalUsersWithReferrals: referralRewards.total_users_with_referrals,
      },
      subscriptions: {
        byTier: subscriptionsByTier,
        total: subscriptionData?.length || 0,
        mrrCents,
        mrrFormatted: `$${(mrrCents / 100).toLocaleString()}`,
        arrCents: mrrCents * 12,
        arrFormatted: `$${((mrrCents * 12) / 100).toLocaleString()}`,
      },
      users: {
        total: totalUsers || 0,
        newLast30Days: newUsersLast30Days || 0,
        growthRate:
          totalUsers && totalUsers > 0
            ? Math.round(((newUsersLast30Days || 0) / totalUsers) * 100)
            : 0,
      },
      usage: {
        searchesThisMonth: usageStats.total_searches_this_month,
        aiOpsThisMonth: usageStats.total_ai_ops_this_month,
        nichesTracked: usageStats.total_niches_tracked,
        avgSearchesPerUser: parseFloat(usageStats.avg_searches_per_user || 0).toFixed(1),
      },
      conversionFunnel: {
        pageViews: conversionFunnel.page_views,
        checkoutStarted: conversionFunnel.checkout_started,
        checkoutCompleted: conversionFunnel.checkout_completed,
        conversionRate: parseFloat(conversionFunnel.conversion_rate || 0).toFixed(1),
      },
    });
  } catch (error) {
    console.error("Pricing metrics error:", error);
    const message = error instanceof Error ? error.message : "Unable to load pricing metrics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
