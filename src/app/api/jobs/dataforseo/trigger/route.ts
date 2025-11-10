/**
 * API endpoint to manually trigger DataForSEO K4K ingestion job
 * POST /api/jobs/dataforseo/trigger
 *
 * This endpoint spawns the DataForSEO K4K job as a child process,
 * allowing manual triggering from UI or external tools.
 *
 * Authentication: Requires admin privileges
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max

interface TriggerJobRequest {
  dryRun?: boolean;
  batchMaxSeeds?: number;
  languageCode?: string;
  locationCode?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // 3. Parse request body
    const body = (await request.json().catch(() => ({}))) as TriggerJobRequest;

    // 4. Validate environment variables
    if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
      return NextResponse.json(
        {
          error: "DataForSEO credentials not configured",
          details: "DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set",
        },
        { status: 500 }
      );
    }

    // 5. Prepare job environment variables
    const jobEnv = {
      ...process.env,
      // DataForSEO credentials
      DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN,
      DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD,

      // Supabase connection
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

      // Job configuration (with request overrides)
      BATCH_MAX_SEEDS: String(body.batchMaxSeeds || 5000),
      K4K_LANGUAGE_CODE: body.languageCode || "en",
      K4K_LOCATION_CODE: body.locationCode || "2840",
      DRY_RUN: String(body.dryRun || false),
      LOG_LEVEL: "info",

      // Job defaults
      LEXYHUB_MARKET: "google",
      K4K_MAX_TERMS_PER_TASK: "20",
      K4K_DEVICE: "desktop",
      K4K_SEARCH_PARTNERS: "false",
      K4K_INCLUDE_ADULT: "false",
      CONCURRENCY_TASK_POST: "20",
      CONCURRENCY_TASK_GET: "20",
      POLL_INTERVAL_MS: "4000",
      POLL_TIMEOUT_MS: "900000",
    };

    // 6. Determine job script path
    const jobScriptPath = "jobs/dataforseo-k4k/index.ts";

    // 7. Log job start
    const { data: jobRun } = await supabase
      .from("job_runs")
      .insert({
        job_name: "dataforseo-k4k",
        status: "started",
        started_at: new Date().toISOString(),
        metadata: {
          triggered_by: user.id,
          trigger_source: "api",
          config: {
            dry_run: body.dryRun,
            batch_max_seeds: body.batchMaxSeeds,
            language_code: body.languageCode,
            location_code: body.locationCode,
          },
        },
      })
      .select("id")
      .single();

    const jobRunId = jobRun?.id;

    // 8. Spawn job as background process
    const child = spawn("npx", ["tsx", jobScriptPath], {
      env: jobEnv,
      detached: true,
      stdio: "ignore",
    });

    // Allow job to run independently
    child.unref();

    // 9. Return immediate response
    return NextResponse.json({
      success: true,
      message: "DataForSEO K4K ingestion job triggered",
      job_run_id: jobRunId,
      pid: child.pid,
      config: {
        dry_run: body.dryRun || false,
        batch_max_seeds: body.batchMaxSeeds || 5000,
        language_code: body.languageCode || "en",
        location_code: body.locationCode || "2840",
      },
      note: "Job is running in background. Check /api/jobs/dataforseo/status for progress.",
    });
  } catch (error) {
    console.error("Error triggering DataForSEO job:", error);
    return NextResponse.json(
      {
        error: "Failed to trigger job",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
