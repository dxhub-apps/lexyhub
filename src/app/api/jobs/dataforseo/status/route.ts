/**
 * API endpoint to check DataForSEO K4K ingestion job status
 * GET /api/jobs/dataforseo/status
 *
 * Returns recent job runs, seed statistics, and ingestion health metrics
 *
 * Authentication: Requires admin privileges
 */

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Authenticate user
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Check if user is admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    // 3. Fetch recent job runs
    const { data: recentRuns, error: runsError } = await supabase
      .from("job_runs")
      .select("*")
      .eq("job_name", "dataforseo-k4k")
      .order("started_at", { ascending: false })
      .limit(10);

    if (runsError) {
      console.error("Error fetching job runs:", runsError);
    }

    // 4. Get seed statistics
    const { data: seedStats, error: seedStatsError } = await supabase.rpc(
      "get_keyword_seeds_stats"
    );

    // If RPC doesn't exist, fall back to manual query
    let seedStatistics = seedStats;
    if (seedStatsError) {
      const { count: totalSeeds } = await supabase
        .from("keyword_seeds")
        .select("*", { count: "exact", head: true });

      const { count: enabledSeeds } = await supabase
        .from("keyword_seeds")
        .select("*", { count: "exact", head: true })
        .eq("enabled", true);

      const { count: pendingSeeds } = await supabase
        .from("keyword_seeds")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("enabled", true);

      const { count: processedSeeds } = await supabase
        .from("keyword_seeds")
        .select("*", { count: "exact", head: true })
        .eq("status", "done");

      seedStatistics = {
        total: totalSeeds || 0,
        enabled: enabledSeeds || 0,
        pending: pendingSeeds || 0,
        processed: processedSeeds || 0,
      };
    }

    // 5. Get raw_sources statistics (staging layer)
    const { count: totalRawSources } = await supabase
      .from("raw_sources")
      .select("*", { count: "exact", head: true })
      .eq("provider", "dataforseo");

    const { count: pendingRawSources } = await supabase
      .from("raw_sources")
      .select("*", { count: "exact", head: true })
      .eq("provider", "dataforseo")
      .eq("status", "pending");

    const { count: completedRawSources } = await supabase
      .from("raw_sources")
      .select("*", { count: "exact", head: true })
      .eq("provider", "dataforseo")
      .eq("status", "completed");

    const { count: failedRawSources } = await supabase
      .from("raw_sources")
      .select("*", { count: "exact", head: true })
      .eq("provider", "dataforseo")
      .eq("status", "failed");

    // 6. Get keywords ingested from DataForSEO
    const { count: dataforSeoKeywords } = await supabase
      .from("keywords")
      .select("*", { count: "exact", head: true })
      .like("ingest_source", "%dataforseo%");

    const { count: totalKeywords } = await supabase
      .from("keywords")
      .select("*", { count: "exact", head: true });

    // 7. Get most recent ingestion timestamp
    const { data: recentKeyword } = await supabase
      .from("keywords")
      .select("created_at, ingest_source")
      .like("ingest_source", "%dataforseo%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 8. Calculate health metrics
    const latestRun = recentRuns?.[0];
    const isHealthy =
      latestRun?.status === "completed" && (pendingSeeds || 0) > 0;

    // 9. Return comprehensive status
    return NextResponse.json({
      status: "ok",
      health: {
        overall: isHealthy ? "healthy" : "needs_attention",
        has_pending_seeds: (pendingSeeds || 0) > 0,
        latest_run_status: latestRun?.status || "none",
        last_ingestion: recentKeyword?.created_at || null,
      },
      job_runs: {
        recent: recentRuns || [],
        latest: latestRun || null,
      },
      seeds: {
        total: seedStatistics?.total || 0,
        enabled: seedStatistics?.enabled || 0,
        pending: seedStatistics?.pending || 0,
        processed: seedStatistics?.processed || 0,
      },
      staging: {
        total_responses: totalRawSources || 0,
        pending: pendingRawSources || 0,
        completed: completedRawSources || 0,
        failed: failedRawSources || 0,
      },
      keywords: {
        total: totalKeywords || 0,
        from_dataforseo: dataforSeoKeywords || 0,
        coverage_percentage:
          totalKeywords && dataforSeoKeywords
            ? ((dataforSeoKeywords / totalKeywords) * 100).toFixed(2)
            : 0,
        last_ingested_at: recentKeyword?.created_at || null,
      },
      environment: {
        credentials_configured: !!(
          process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD
        ),
        supabase_configured: !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
      },
    });
  } catch (error) {
    console.error("Error fetching DataForSEO job status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch job status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
