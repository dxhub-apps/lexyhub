import { NextResponse } from "next/server";

import {
  KEYWORD_TELEMETRY_LOOKBACK_DAYS,
  filterExistingKeywordStats,
  getKeywordTelemetryWindowStart,
  type KeywordStatAggregate,
  type KeywordStatIdentity,
} from "@/lib/keywords/telemetry";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(numeric) ? numeric : null;
}

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

const FEATURE_FLAG_KEY = "allow_user_telemetry";

export async function POST(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured." },
      { status: 500 },
    );
  }

  const jobRunId = await createJobRun(supabase, "keyword-telemetry");

  try {
    const { data: flagRow, error: flagError } = await supabase
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", FEATURE_FLAG_KEY)
      .maybeSingle();

    if (flagError) {
      throw new Error(flagError.message);
    }

    if (!flagRow?.is_enabled) {
      await finalizeJobRun(supabase, jobRunId, "succeeded", {
        message: "Keyword telemetry job skipped; feature flag disabled.",
      });
      return NextResponse.json(
        { message: "Keyword telemetry job skipped; feature flag disabled." },
        { status: 202 },
      );
    }

    const now = new Date();
    const windowStartIso = getKeywordTelemetryWindowStart(now, KEYWORD_TELEMETRY_LOOKBACK_DAYS);
    const windowStartDate = windowStartIso.slice(0, 10);

    const { data: existingRows, error: existingError } = await supabase
      .from("keyword_stats")
      .select("keyword_id, source, recorded_on")
      .gte("recorded_on", windowStartDate);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const { data: aggregates, error: aggregateError } = await supabase.rpc(
      "keyword_telemetry_rollup",
      {
        window_start: windowStartIso,
        window_end: now.toISOString(),
      },
    );

    if (aggregateError) {
      throw new Error(aggregateError.message);
    }

    const filtered = filterExistingKeywordStats(
      ((aggregates ?? []) as KeywordStatAggregate[]).map((row) => ({
        ...row,
        metadata: row.metadata ?? {},
      })),
      (existingRows ?? []) as KeywordStatIdentity[],
    );

    if (filtered.length === 0) {
      await finalizeJobRun(supabase, jobRunId, "succeeded", {
        recordsProcessed: 0,
        windowStart: windowStartIso,
        windowEnd: now.toISOString(),
      });
      return NextResponse.json({
        message: "No keyword telemetry updates available.",
        processed: 0,
      });
    }

    const payload = filtered.map((row) => ({
      keyword_id: row.keyword_id,
      source: row.source,
      recorded_on: row.recorded_on,
      search_volume: normalizeNumber(row.search_volume),
      impressions: normalizeNumber(row.impressions),
      clicks: normalizeNumber(row.clicks),
      ctr: normalizeNumber(row.ctr),
      conversion_rate: normalizeNumber(row.conversion_rate),
      cost_cents: normalizeNumber(row.cost_cents),
      rank: normalizeNumber(row.rank),
      metadata: row.metadata ?? {},
    }));

    const { error: upsertError } = await supabase
      .from("keyword_stats")
      .upsert(payload, { onConflict: "keyword_id,source,recorded_on" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await finalizeJobRun(supabase, jobRunId, "succeeded", {
      recordsProcessed: payload.length,
      windowStart: windowStartIso,
      windowEnd: now.toISOString(),
    });

    return NextResponse.json({
      processed: payload.length,
      windowStart: windowStartIso,
      windowEnd: now.toISOString(),
    });
  } catch (error) {
    console.error("Keyword telemetry job failed", error);
    await finalizeJobRun(supabase, jobRunId, "failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Keyword telemetry aggregation failed" },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
