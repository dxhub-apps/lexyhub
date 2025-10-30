import { NextResponse } from "next/server";

import { aggregateTrendSignals } from "@/lib/trends";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function createJobRun(supabase: ReturnType<typeof getSupabaseServerClient>, jobName: string) {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("job_runs")
    .insert({ job_name: jobName, status: "running" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn(`Failed to create job_runs entry for ${jobName}`, error);
  }

  return data?.id ?? null;
}

async function finalizeJobRun(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  jobRunId: string | null,
  status: "succeeded" | "failed",
  metadata: Record<string, unknown>,
) {
  if (!supabase || !jobRunId) {
    return;
  }

  const { error } = await supabase
    .from("job_runs")
    .update({ status, finished_at: new Date().toISOString(), metadata })
    .eq("id", jobRunId);

  if (error) {
    console.warn("Failed to finalize job_runs entry", error);
  }
}

export async function POST(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured." },
      { status: 500 },
    );
  }

  const jobRunId = await createJobRun(supabase, "trend-aggregation");

  try {
    const { records, momentumByTerm } = await aggregateTrendSignals();

    if (records.length === 0) {
      await finalizeJobRun(supabase, jobRunId, "succeeded", {
        recordsProcessed: 0,
        message: "No trend signals available.",
      });
      return NextResponse.json({ message: "No trend signals available", processed: 0 });
    }

    const { error: upsertError } = await supabase.from("trend_series").upsert(records, {
      onConflict: "term,source,recorded_on",
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    let keywordsUpdated = 0;

    for (const [term, metrics] of momentumByTerm.entries()) {
      const { data: existing, error: loadError } = await supabase
        .from("keywords")
        .select("id, extras")
        .eq("term", term);

      if (loadError) {
        console.warn(`Failed to load keyword extras for ${term}`, loadError);
        continue;
      }

      for (const keyword of existing ?? []) {
        const extras = keyword.extras && typeof keyword.extras === "object" ? { ...keyword.extras } : {};
        extras.trend = {
          momentum: metrics.momentum,
          expectedGrowth30d: metrics.expectedGrowth,
          contributors: metrics.contributors,
          updatedAt: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("keywords")
          .update({ trend_momentum: metrics.momentum, extras })
          .eq("id", keyword.id);

        if (updateError) {
          console.warn(`Failed to update keyword ${keyword.id} trend metrics`, updateError);
          continue;
        }

        keywordsUpdated += 1;
      }
    }

    await finalizeJobRun(supabase, jobRunId, "succeeded", {
      recordsProcessed: records.length,
      keywordsUpdated,
    });

    return NextResponse.json({ processed: records.length, keywordsUpdated });
  } catch (error) {
    console.error("Trend aggregation job failed", error);
    await finalizeJobRun(supabase, jobRunId, "failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trend aggregation failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
