/**
 * API Endpoint: Get Job Statuses
 * GET /api/admin/jobs/status
 *
 * Returns the status of all configured background jobs
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminUser, AdminAccessError } from "@/lib/backoffice/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Job definitions with schedule and descriptions
const JOB_DEFINITIONS = [
  {
    id: "dataforseo",
    name: "DataForSEO K4K Ingestion",
    endpoint: "/api/jobs/dataforseo/trigger",
    schedule: "Manual / On-demand",
    description: "Fetches keyword expansion data from DataForSEO and populates the keywords table",
    category: "Data Collection",
  },
  {
    id: "ingest-metrics",
    name: "Keyword Metrics Collection",
    endpoint: "/api/jobs/ingest-metrics",
    schedule: "Daily at 02:00 UTC",
    description: "Collects metrics for active keywords and computes demand indices and trends",
    category: "Metrics",
  },
  {
    id: "social-metrics",
    name: "Social Metrics Aggregation",
    endpoint: "/api/jobs/social-metrics",
    schedule: "Every 6 hours",
    description: "Aggregates social signals from Reddit, Twitter, Pinterest, and TikTok",
    category: "Metrics",
  },
  {
    id: "trend-aggregation",
    name: "Trend Aggregation",
    endpoint: "/api/jobs/trend-aggregation",
    schedule: "Every 6 hours",
    description: "Aggregates external and synthetic trend signals into trend_series",
    category: "Analytics",
  },
  {
    id: "intent-classify",
    name: "Intent Classification",
    endpoint: "/api/jobs/intent-classify",
    schedule: "Daily at 03:00 UTC",
    description: "Classifies keywords and listings into purchase intent categories",
    category: "Analytics",
  },
  {
    id: "rebuild-clusters",
    name: "Rebuild Semantic Clusters",
    endpoint: "/api/jobs/rebuild-clusters",
    schedule: "Daily at 04:00 UTC",
    description: "Recomputes semantic clusters to group related keywords",
    category: "Analytics",
  },
  {
    id: "embed-missing",
    name: "Generate Embeddings",
    endpoint: "/api/jobs/embed-missing",
    schedule: "Hourly",
    description: "Generates vector embeddings for keywords and listings without embeddings",
    category: "AI",
  },
  {
    id: "keyword-telemetry",
    name: "Keyword Telemetry",
    endpoint: "/api/jobs/keyword-telemetry",
    schedule: "Daily at 00:30 UTC",
    description: "Collapses keyword_events into daily keyword_stats",
    category: "Analytics",
  },
  {
    id: "etsy-sync",
    name: "Etsy Marketplace Sync",
    endpoint: "/api/jobs/etsy-sync",
    schedule: "Every 6 hours",
    description: "Syncs listings, tags, and shop metadata from Etsy",
    category: "Data Collection",
  },
  {
    id: "ingest-corpus-metrics",
    name: "Ingest Metrics to Corpus",
    endpoint: "/api/jobs/ingest-corpus/metrics",
    schedule: "Daily at 05:00 UTC",
    description: "Reads keyword_metrics tables and creates chunks in ai_corpus with embeddings",
    category: "AI Corpus",
  },
  {
    id: "ingest-corpus-risks",
    name: "Ingest Risks to Corpus",
    endpoint: "/api/jobs/ingest-corpus/risks",
    schedule: "Daily at 05:15 UTC",
    description: "Ingests risk rules and events into ai_corpus for LexyBrain",
    category: "AI Corpus",
  },
  {
    id: "ingest-corpus-predictions",
    name: "Ingest Predictions to Corpus",
    endpoint: "/api/jobs/ingest-corpus/predictions",
    schedule: "Daily at 05:30 UTC",
    description: "Reads keyword_predictions and creates forecast chunks in ai_corpus",
    category: "AI Corpus",
  },
  {
    id: "ingest-corpus-all",
    name: "Ingest All to Corpus",
    endpoint: "/api/jobs/ingest-corpus/all",
    schedule: "Manual / On-demand",
    description: "Runs all corpus ingestion jobs sequentially (metrics, predictions, risks)",
    category: "AI Corpus",
  },
] as const;

type JobDefinition = (typeof JOB_DEFINITIONS)[number];

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

    // Get the last run for each job
    const jobStatuses = await Promise.all(
      JOB_DEFINITIONS.map(async (job) => {
        // Query the most recent run for this job
        const { data: lastRun, error } = await supabase
          .from("job_runs")
          .select("*")
          .eq("job_name", job.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.warn(`Error fetching last run for ${job.id}:`, error);
        }

        // Determine status based on last run
        let status: "success" | "warning" | "error" | "unknown" = "unknown";
        let lastRunTime: string | null = null;
        let lastRunDuration: number | null = null;
        let lastRunStatus: string | null = null;
        let lastRunMetadata: Record<string, unknown> | null = null;

        if (lastRun) {
          lastRunTime = lastRun.started_at;
          lastRunStatus = lastRun.status;
          lastRunMetadata = lastRun.metadata as Record<string, unknown> | null;

          if (lastRun.started_at && lastRun.finished_at) {
            lastRunDuration =
              new Date(lastRun.finished_at).getTime() -
              new Date(lastRun.started_at).getTime();
          }

          // Determine status color
          if (lastRun.status === "succeeded" || lastRun.status === "success" || lastRun.status === "completed") {
            const lastRunDate = new Date(lastRun.started_at);
            const now = new Date();
            const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);

            // Warning if last successful run was more than 48 hours ago
            if (hoursSinceLastRun > 48) {
              status = "warning";
            } else {
              status = "success";
            }
          } else if (lastRun.status === "running" || lastRun.status === "in_progress") {
            status = "warning";
          } else {
            status = "error";
          }
        }

        return {
          ...job,
          status,
          lastRunTime,
          lastRunDuration,
          lastRunStatus,
          lastRunMetadata,
        };
      })
    );

    return NextResponse.json({
      jobs: jobStatuses,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    console.error("Error fetching job statuses:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
