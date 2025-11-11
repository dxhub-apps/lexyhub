/**
 * API Endpoint: Get Admin Dashboard Stats
 * GET /api/admin/dashboard/stats
 *
 * Returns comprehensive KPIs for the admin dashboard including:
 * - Job status summary
 * - Database counts (keywords, ai_corpus, users)
 * - Subscription metrics (active paid users, revenue, churn)
 * - Usage and quality metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser, AdminAccessError } from "@/lib/backoffice/auth";
import { PLAN_CONFIGS } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    await requireAdminUser();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    // Parallel fetch all metrics
    const [
      jobStatsResult,
      keywordsCountResult,
      aiCorpusCountResult,
      usersCountResult,
      subscriptionsResult,
      recentUsersResult,
      invoicesResult,
      churnDataResult,
      feedbackCountResult,
      aiUsageResult,
    ] = await Promise.allSettled([
      // 1. Job Status Summary
      supabase
        .from("job_runs")
        .select("job_name, status, started_at")
        .order("started_at", { ascending: false }),

      // 2. Keywords count
      supabase
        .from("keywords")
        .select("*", { count: "exact", head: true }),

      // 3. AI Corpus count
      supabase
        .from("ai_corpus")
        .select("*", { count: "exact", head: true }),

      // 4. Total users count
      supabase
        .from("user_profiles")
        .select("*", { count: "exact", head: true }),

      // 5. Active subscriptions
      supabase
        .from("billing_subscriptions")
        .select("plan, status, created_at, canceled_at, current_period_end")
        .in("status", ["active", "trialing"]),

      // 6. Recent user signups (last 30 days)
      supabase
        .from("user_profiles")
        .select("created_at", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // 7. Recent invoices for revenue calculation
      supabase
        .from("billing_invoice_events")
        .select("amount_paid_cents, invoice_date, status")
        .eq("status", "paid")
        .gte("invoice_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // 8. Churn data - canceled subscriptions
      supabase
        .from("billing_subscriptions")
        .select("canceled_at, plan")
        .not("canceled_at", "is", null)
        .gte("canceled_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),

      // 9. Feedback count
      supabase
        .from("feedback")
        .select("*", { count: "exact", head: true }),

      // 10. AI usage events
      supabase
        .from("ai_usage_events")
        .select("tokens_in, tokens_out, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Process job stats
    const jobStats = jobStatsResult.status === "fulfilled" ? jobStatsResult.value.data || [] : [];
    const jobsByName = new Map<string, { status: string; lastRun: string }>();

    jobStats.forEach((run: any) => {
      if (!jobsByName.has(run.job_name)) {
        jobsByName.set(run.job_name, {
          status: run.status,
          lastRun: run.started_at,
        });
      }
    });

    const jobStatusSummary = {
      total: jobsByName.size,
      succeeded: Array.from(jobsByName.values()).filter(j =>
        j.status === "succeeded" || j.status === "success" || j.status === "completed"
      ).length,
      failed: Array.from(jobsByName.values()).filter(j =>
        j.status === "failed" || j.status === "error"
      ).length,
      running: Array.from(jobsByName.values()).filter(j =>
        j.status === "running" || j.status === "in_progress"
      ).length,
    };

    // Process counts
    const keywordsCount = keywordsCountResult.status === "fulfilled"
      ? keywordsCountResult.value.count || 0
      : 0;

    const aiCorpusCount = aiCorpusCountResult.status === "fulfilled"
      ? aiCorpusCountResult.value.count || 0
      : 0;

    const totalUsers = usersCountResult.status === "fulfilled"
      ? usersCountResult.value.count || 0
      : 0;

    const newUsersLast30Days = recentUsersResult.status === "fulfilled"
      ? recentUsersResult.value.count || 0
      : 0;

    // Process subscriptions
    const subscriptions = subscriptionsResult.status === "fulfilled"
      ? subscriptionsResult.value.data || []
      : [];

    const activePaidUsers = subscriptions.filter((sub: any) =>
      sub.plan !== "free" && sub.status === "active"
    ).length;

    let mrrCents = 0;
    const subscriptionsByPlan: Record<string, number> = {
      free: totalUsers - subscriptions.length, // Approximate free users
    };

    subscriptions.forEach((sub: any) => {
      const plan = sub.plan || "free";
      subscriptionsByPlan[plan] = (subscriptionsByPlan[plan] || 0) + 1;

      // Calculate MRR
      const planConfig = PLAN_CONFIGS[plan as keyof typeof PLAN_CONFIGS];
      if (planConfig && sub.status === "active") {
        mrrCents += planConfig.price_monthly_cents;
      }
    });

    // Process revenue
    const invoices = invoicesResult.status === "fulfilled"
      ? invoicesResult.value.data || []
      : [];

    const revenueLastMonth = invoices.reduce((sum: number, inv: any) =>
      sum + (inv.amount_paid_cents || 0), 0
    ) / 100; // Convert to dollars

    // Process churn
    const churnData = churnDataResult.status === "fulfilled"
      ? churnDataResult.value.data || []
      : [];

    const churnedUsersLast30Days = churnData.length;
    const churnRate = activePaidUsers > 0
      ? ((churnedUsersLast30Days / (activePaidUsers + churnedUsersLast30Days)) * 100).toFixed(2)
      : "0.00";

    // Process feedback
    const feedbackCount = feedbackCountResult.status === "fulfilled"
      ? feedbackCountResult.value.count || 0
      : 0;

    // Process AI usage
    const aiUsage = aiUsageResult.status === "fulfilled"
      ? aiUsageResult.value.data || []
      : [];

    const totalTokens = aiUsage.reduce((sum: number, event: any) =>
      sum + (event.tokens_in || 0) + (event.tokens_out || 0), 0
    );

    const avgDailyTokens = aiUsage.length > 0 ? Math.round(totalTokens / 7) : 0;

    // Compile response
    return NextResponse.json({
      timestamp: new Date().toISOString(),

      // Jobs
      jobs: jobStatusSummary,

      // Database Counts
      database: {
        keywords: keywordsCount,
        aiCorpus: aiCorpusCount,
        feedback: feedbackCount,
      },

      // Users
      users: {
        total: totalUsers,
        newLast30Days: newUsersLast30Days,
        growthRate: totalUsers > 0
          ? ((newUsersLast30Days / totalUsers) * 100).toFixed(1)
          : "0.0",
      },

      // Subscriptions
      subscriptions: {
        activePaid: activePaidUsers,
        total: subscriptions.length,
        byPlan: subscriptionsByPlan,
        mrrCents,
        mrr: `$${(mrrCents / 100).toLocaleString()}`,
        arr: `$${((mrrCents * 12) / 100).toLocaleString()}`,
      },

      // Revenue
      revenue: {
        last30Days: revenueLastMonth,
        formatted: `$${revenueLastMonth.toLocaleString()}`,
        mrr: `$${(mrrCents / 100).toLocaleString()}`,
        arr: `$${((mrrCents * 12) / 100).toLocaleString()}`,
      },

      // Churn
      churn: {
        last30Days: churnedUsersLast30Days,
        rate: churnRate,
        rateFormatted: `${churnRate}%`,
      },

      // Quality Metrics
      quality: {
        aiTokensLast7Days: totalTokens,
        avgDailyTokens,
        aiRequestsLast7Days: aiUsage.length,
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
