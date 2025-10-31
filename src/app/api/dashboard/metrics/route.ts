import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type Metric = {
  area: string;
  status: "configured" | "pending";
  owner: string;
  notes: string;
};

function buildStatus(
  condition: boolean,
  { success, failure }: { success: string; failure: string },
): { status: Metric["status"]; notes: string } {
  return condition
    ? { status: "configured", notes: success }
    : { status: "pending", notes: failure };
}

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase client unavailable" },
      { status: 503 },
    );
  }

  const [providersRes, accountsRes, watchlistsRes, jobRunsRes] = await Promise.all([
    supabase
      .from("data_providers")
      .select("id, display_name, provider_type, is_enabled, updated_at"),
    supabase
      .from("marketplace_accounts")
      .select("id, provider_id, status, last_synced_at"),
    supabase
      .from("watchlists")
      .select("id, capacity"),
    supabase
      .from("job_runs")
      .select("job_name, status, finished_at, started_at")
      .order("started_at", { ascending: false })
      .limit(25),
  ]);

  if (providersRes.error) {
    return NextResponse.json(
      { error: `Unable to read data providers: ${providersRes.error.message}` },
      { status: 500 },
    );
  }

  if (accountsRes.error) {
    return NextResponse.json(
      { error: `Unable to read marketplace accounts: ${accountsRes.error.message}` },
      { status: 500 },
    );
  }

  if (watchlistsRes.error) {
    return NextResponse.json(
      { error: `Unable to read watchlists: ${watchlistsRes.error.message}` },
      { status: 500 },
    );
  }

  if (jobRunsRes.error) {
    return NextResponse.json(
      { error: `Unable to read job activity: ${jobRunsRes.error.message}` },
      { status: 500 },
    );
  }

  const providers = providersRes.data ?? [];
  const accounts = accountsRes.data ?? [];
  const watchlists = watchlistsRes.data ?? [];
  const jobRuns = jobRunsRes.data ?? [];

  const enabledProviders = providers.filter((provider) => provider.is_enabled).length;
  const { status: providersStatus, notes: providersNotes } = buildStatus(enabledProviders > 0, {
    success: `${enabledProviders}/${providers.length} providers enabled`,
    failure: "No providers enabled",
  });

  const activeAccounts = accounts.filter((account) => (account.status ?? "").toLowerCase() === "active").length;
  const { status: accountsStatus, notes: accountsNotes } = buildStatus(activeAccounts > 0, {
    success: `${activeAccounts}/${accounts.length} marketplace accounts active`,
    failure: "Marketplace accounts not connected",
  });

  const totalWatchlists = watchlists.length;
  const aggregateCapacity = watchlists.reduce((sum, record) => sum + Number(record.capacity ?? 0), 0);
  const { status: watchlistsStatus, notes: watchlistsNotes } = buildStatus(totalWatchlists > 0, {
    success: `${totalWatchlists} watchlists · capacity ${aggregateCapacity}`,
    failure: "No watchlists have been created",
  });

  const latestRuns = new Map<string, { status: string; finishedAt?: string | null }>();
  for (const run of jobRuns) {
    const jobName = run.job_name ?? "unknown";
    if (!latestRuns.has(jobName)) {
      latestRuns.set(jobName, { status: run.status ?? "unknown", finishedAt: run.finished_at ?? run.started_at });
    }
  }

  let allJobsHealthy = true;
  let jobMessage = "No job executions recorded";
  if (latestRuns.size > 0) {
    const unhealthy: string[] = [];
    for (const [name, run] of latestRuns.entries()) {
      const status = (run.status ?? "").toLowerCase();
      const finished = run.finishedAt ? new Date(run.finishedAt).toLocaleString() : "unscheduled";
      const isSuccess = ["succeeded", "success", "completed", "complete"].includes(status);
      const isRunning = ["running", "in_progress", "processing"].includes(status);
      if (!isSuccess && !isRunning) {
        unhealthy.push(`${name} (${status || "unknown"}, last ${finished})`);
      }
    }

    if (unhealthy.length > 0) {
      allJobsHealthy = false;
      jobMessage = unhealthy.join("; ");
    } else {
      jobMessage = `${latestRuns.size} jobs healthy`;
    }
  }

  const metrics: Metric[] = [
    {
      area: "Data providers",
      owner: "Data",
      status: providersStatus,
      notes: providersNotes,
    },
    {
      area: "Marketplace accounts",
      owner: "Platform",
      status: accountsStatus,
      notes: accountsNotes,
    },
    {
      area: "Watchlists",
      owner: "Product",
      status: watchlistsStatus,
      notes: watchlistsNotes,
    },
    {
      area: "Background jobs",
      owner: "Platform",
      status: allJobsHealthy ? "configured" : "pending",
      notes: jobMessage,
    },
  ];

  return NextResponse.json({ metrics });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
