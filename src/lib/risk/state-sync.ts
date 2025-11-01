import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { HealthMetric } from "@/lib/backoffice/status";

import type { RiskAppetite, RiskControl, RiskRegisterEntry } from "./service";

const STALE_CRAWLER_THRESHOLD_HOURS = 6;
const STALE_SEED_THRESHOLD_HOURS = 12;
const KEYWORD_CORPUS_TARGET = 200;
const STALE_SYNC_THRESHOLD_HOURS = 12;
const STALE_JOB_THRESHOLD_HOURS = 12;
const STALE_WEBHOOK_THRESHOLD_MINUTES = 45;
const API_ERROR_RATE_WARNING = 0.05;
const API_ERROR_RATE_CRITICAL = 0.15;
const BILLING_OUTSTANDING_WARNING_CENTS = 10000;
const BILLING_OUTSTANDING_CRITICAL_CENTS = 50000;
const API_HEALTH_WINDOW_HOURS = 6;

const APPETITE_DATA_PIPELINE_ID = "b9effbf9-9dc7-469c-bda2-da2ecebd2e4f";
const APPETITE_MARKET_INTELLIGENCE_ID = "519ce5f9-070a-41e6-b165-5471d6eff1e4";
const APPETITE_AI_READINESS_ID = "f03569e9-a809-4b3c-be09-6cea0ec8f1d1";
const APPETITE_MARKETPLACE_INTEGRITY_ID = "99c16f8f-4aa5-4e03-b19b-2d604c7d8b3a";
const APPETITE_AUTOMATION_UPTIME_ID = "cb1f8e9c-8dbd-4f93-8da9-9f7ef3d5e7f4";
const APPETITE_BILLING_GOVERNANCE_ID = "03b6f0dc-8d1a-4ee5-9f7f-f9fb00aabf8c";

const CONTROL_CRAWLER_OBSERVABILITY_ID = "f122a20a-1a42-4c76-ba28-4a38344a9534";
const CONTROL_SEED_ROTATION_ID = "4cdca7c9-3120-4a37-b240-883f5b945bb4";
const CONTROL_AI_INTEGRATIONS_ID = "a8e17080-7ef7-4357-a9ac-785579ab39a3";
const CONTROL_MARKETPLACE_SYNCS_ID = "2e5b1d2a-2fbb-4d31-9e55-4f4d83e6a7d2";
const CONTROL_JOB_AUTOMATION_ID = "c91bf4e9-3f19-4a37-9c5f-8f4a15e25671";
const CONTROL_API_HEALTH_ID = "c64a9ba7-48f3-4708-b308-8b417be3f5ce";
const CONTROL_BILLING_INCIDENTS_ID = "9b4c9153-7f73-4e7c-a98f-5348f859dd5f";

const RISK_CRAWLER_GAPS_ID = "01c8f68d-0ecb-451e-a19a-e26eb97d9803";
const RISK_KEYWORD_COVERAGE_ID = "11c85cf4-f0a3-4357-a521-cbfbb4170ba9";
const RISK_AI_CONFIGURATION_ID = "a7a3f46c-587d-443a-af7e-49222ee23d91";
const RISK_MARKETPLACE_SYNC_ID = "73ddc3ab-725f-4a46-9b18-9a63a1bfb35c";
const RISK_BACKGROUND_JOBS_ID = "c7b9c9df-f8b4-4c3e-94cf-62e5d108f7b6";
const RISK_API_ERROR_RATE_ID = "65c0de81-388b-46d2-867b-9de91c796c8e";
const RISK_BILLING_EXCEPTIONS_ID = "870280c0-9918-4a75-9e35-8e8cf0a3fde9";

const HOURS_TO_MS = 60 * 60 * 1000;

function assertClient(client: SupabaseClient | null): SupabaseClient {
  if (!client) {
    throw new Error("Supabase client is not configured");
  }
  return client;
}

type KeywordSeedRow = {
  id: string;
  term: string | null;
  status: string | null;
  priority: number | null;
  last_run_at: string | null;
  next_run_at: string | null;
  updated_at: string | null;
};

type CrawlerStatusRow = {
  id: string;
  source: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  total_records: number | null;
  error_message: string | null;
  run_metadata: Record<string, unknown> | null;
  updated_at: string | null;
};

type ProviderRow = {
  id: string;
  display_name: string | null;
  is_enabled: boolean | null;
  updated_at: string | null;
};

type MarketplaceAccountRow = {
  id: string;
  provider_id: string | null;
  status: string | null;
  last_synced_at: string | null;
};

type SyncStateRow = {
  id: string;
  sync_type: string | null;
  status: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  message: string | null;
};

type JobRunRow = {
  job_name: string | null;
  status: string | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

type WatchlistRow = {
  id: string;
  capacity: number | null;
};

type WatchlistItemRow = {
  id: string;
  watchlist_id: string;
};

type InvoiceRow = {
  id: string;
  amount_due_cents: number | null;
  amount_paid_cents: number | null;
  status: string | null;
  invoice_date: string | null;
};

type WebhookRow = {
  id: string;
  provider: string;
  event_type: string | null;
  status: string | null;
  received_at: string | null;
  processed_at: string | null;
  error_message: string | null;
};

type ApiLogRow = {
  id: number;
  status_code: number | null;
  route: string | null;
  method: string | null;
  requested_at: string | null;
  latency_ms: number | null;
};

type ExistingRegisterRow = {
  id: string;
  raised_at: string | null;
  status: string;
};

function addDays(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 24 * HOURS_TO_MS).toISOString();
}

function limitList(values: string[], max = 8): string[] {
  return values.slice(0, max);
}

export async function syncRiskDataFromState(): Promise<{
  appetites: RiskAppetite[];
  controls: RiskControl[];
  register: RiskRegisterEntry[];
  metrics: HealthMetric[];
}> {
  const client = assertClient(getSupabaseServerClient());
  const now = new Date();
  const nowIso = now.toISOString();

  const [
    keywordCountResp,
    keywordMarketsResp,
    latestKeywordResp,
    seedRowsResp,
    crawlerRowsResp,
    providerRowsResp,
    accountRowsResp,
    syncStatesResp,
    jobRunsResp,
    watchlistsResp,
    watchlistItemsResp,
    invoiceRowsResp,
    webhookRowsResp,
    apiLogsResp,
  ] = await Promise.all([
    client.from("keywords").select("id", { count: "exact", head: true }),
    client
      .from("keywords")
      .select("market")
      .not("market", "is", null)
      .limit(1000),
    client
      .from("keywords")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from("keyword_seeds")
      .select("id,term,status,priority,last_run_at,next_run_at,updated_at")
      .order("updated_at", { ascending: false }),
    client
      .from("crawler_statuses")
      .select("id,source,status,last_run_at,next_run_at,total_records,error_message,run_metadata,updated_at")
      .order("updated_at", { ascending: false }),
    client.from("data_providers").select("id,display_name,is_enabled,updated_at"),
    client.from("marketplace_accounts").select("id,provider_id,status,last_synced_at"),
    client
      .from("provider_sync_states")
      .select("id,sync_type,status,last_run_at,next_run_at,message"),
    client
      .from("job_runs")
      .select("job_name,status,started_at,finished_at,error_message")
      .order("started_at", { ascending: false })
      .limit(50),
    client.from("watchlists").select("id,capacity"),
    client.from("watchlist_items").select("id,watchlist_id"),
    client
      .from("billing_invoice_events")
      .select("id,amount_due_cents,amount_paid_cents,status,invoice_date")
      .order("invoice_date", { ascending: false })
      .limit(50),
    client
      .from("webhook_events")
      .select("id,provider,event_type,status,received_at,processed_at,error_message")
      .order("received_at", { ascending: false })
      .limit(200),
    client
      .from("api_request_logs")
      .select("id,status_code,route,method,requested_at,latency_ms")
      .order("requested_at", { ascending: false })
      .limit(200),
  ]);

  if (keywordCountResp.error) {
    throw new Error(`Unable to count keywords: ${keywordCountResp.error.message}`);
  }
  if (keywordMarketsResp.error) {
    throw new Error(`Unable to load keyword markets: ${keywordMarketsResp.error.message}`);
  }
  if (latestKeywordResp.error) {
    throw new Error(`Unable to load keyword freshness: ${latestKeywordResp.error.message}`);
  }
  if (seedRowsResp.error) {
    throw new Error(`Unable to load keyword seeds: ${seedRowsResp.error.message}`);
  }
  if (crawlerRowsResp.error) {
    throw new Error(`Unable to load crawler statuses: ${crawlerRowsResp.error.message}`);
  }
  if (providerRowsResp.error) {
    throw new Error(`Unable to load data providers: ${providerRowsResp.error.message}`);
  }
  if (accountRowsResp.error) {
    throw new Error(`Unable to load marketplace accounts: ${accountRowsResp.error.message}`);
  }
  if (syncStatesResp.error) {
    throw new Error(`Unable to load provider sync states: ${syncStatesResp.error.message}`);
  }
  if (jobRunsResp.error) {
    throw new Error(`Unable to load job runs: ${jobRunsResp.error.message}`);
  }
  if (watchlistsResp.error) {
    throw new Error(`Unable to load watchlists: ${watchlistsResp.error.message}`);
  }
  if (watchlistItemsResp.error) {
    throw new Error(`Unable to load watchlist items: ${watchlistItemsResp.error.message}`);
  }
  if (invoiceRowsResp.error) {
    throw new Error(`Unable to load billing invoices: ${invoiceRowsResp.error.message}`);
  }
  if (webhookRowsResp.error) {
    throw new Error(`Unable to load webhook events: ${webhookRowsResp.error.message}`);
  }
  if (apiLogsResp.error) {
    throw new Error(`Unable to load API request logs: ${apiLogsResp.error.message}`);
  }

  const keywordCount = keywordCountResp.count ?? 0;
  const keywordMarkets = (keywordMarketsResp.data ?? []) as Array<{ market: string | null }>;
  const uniqueMarkets = new Set(
    keywordMarkets
      .map((row) => row.market)
      .filter((market): market is string => Boolean(market)),
  ).size;
  const latestKeywordAt = latestKeywordResp.data?.updated_at ?? null;
  const seedRows = (seedRowsResp.data ?? []) as KeywordSeedRow[];
  const crawlerRows = (crawlerRowsResp.data ?? []) as CrawlerStatusRow[];
  const providerRows = (providerRowsResp.data ?? []) as ProviderRow[];
  const accountRows = (accountRowsResp.data ?? []) as MarketplaceAccountRow[];
  const syncStateRows = (syncStatesResp.data ?? []) as SyncStateRow[];
  const jobRunRows = (jobRunsResp.data ?? []) as JobRunRow[];
  const watchlists = (watchlistsResp.data ?? []) as WatchlistRow[];
  const watchlistItems = (watchlistItemsResp.data ?? []) as WatchlistItemRow[];
  const invoiceRows = (invoiceRowsResp.data ?? []) as InvoiceRow[];
  const webhookRows = (webhookRowsResp.data ?? []) as WebhookRow[];
  const apiLogs = (apiLogsResp.data ?? []) as ApiLogRow[];

  const openAIConfigured = Boolean(env.OPENAI_API_KEY);

  const staleSeedCutoff = now.getTime() - STALE_SEED_THRESHOLD_HOURS * HOURS_TO_MS;
  const pendingSeeds = seedRows.filter((seed) => (seed.status ?? "pending") !== "complete").length;
  const staleSeeds = seedRows.filter((seed) => {
    if ((seed.status ?? "pending") === "disabled") {
      return false;
    }
    const lastRun = seed.last_run_at ? Date.parse(seed.last_run_at) : null;
    return lastRun === null || lastRun < staleSeedCutoff;
  });
  const oldestPendingSeedAt = seedRows.reduce<number | null>((oldest, seed) => {
    if ((seed.status ?? "pending") === "complete") {
      return oldest;
    }
    const updatedAt = seed.updated_at ? Date.parse(seed.updated_at) : null;
    if (updatedAt === null) {
      return oldest;
    }
    return oldest === null || updatedAt < oldest ? updatedAt : oldest;
  }, null);

  const telemetryMissing = crawlerRows.length === 0;
  const staleCrawlerCutoff = now.getTime() - STALE_CRAWLER_THRESHOLD_HOURS * HOURS_TO_MS;
  const failingCrawlers = crawlerRows.filter((crawler) => crawler.status.toLowerCase() === "error");
  const staleCrawlers = crawlerRows.filter((crawler) => {
    const updatedAt = crawler.updated_at ? Date.parse(crawler.updated_at) : null;
    const lastRunAt = crawler.last_run_at ? Date.parse(crawler.last_run_at) : null;
    if (updatedAt === null && lastRunAt === null) {
      return true;
    }
    const reference = updatedAt ?? lastRunAt ?? 0;
    return reference < staleCrawlerCutoff;
  });
  const mostRecentCrawlerRunAt = crawlerRows.reduce<number | null>((latest, crawler) => {
    const lastRunAt = crawler.last_run_at ? Date.parse(crawler.last_run_at) : null;
    if (lastRunAt === null) {
      return latest;
    }
    return latest === null || lastRunAt > latest ? lastRunAt : latest;
  }, null);

  const providerCount = providerRows.length;
  const enabledProviders = providerRows.filter((provider) => provider.is_enabled !== false);
  const disabledProviders = providerRows.filter((provider) => provider.is_enabled === false);
  const disabledProviderLabels = limitList(
    disabledProviders.map((provider) => provider.display_name ?? provider.id ?? "unknown"),
  );

  const accountCount = accountRows.length;
  const activeAccounts = accountRows.filter((account) => (account.status ?? "").toLowerCase() === "active");
  const suspendedAccounts = accountRows.filter((account) =>
    ["suspended", "disconnected", "revoked"].includes((account.status ?? "").toLowerCase()),
  );
  const staleSyncCutoff = now.getTime() - STALE_SYNC_THRESHOLD_HOURS * HOURS_TO_MS;
  const syncFailing = syncStateRows.filter((state) =>
    ["error", "failed", "halted", "blocked"].includes((state.status ?? "").toLowerCase()),
  );
  const syncStale = syncStateRows.filter((state) => {
    const lastRun = state.last_run_at ? Date.parse(state.last_run_at) : null;
    if (lastRun === null) {
      return true;
    }
    return lastRun < staleSyncCutoff;
  });
  const syncPending = syncStateRows.filter((state) =>
    ["pending", "queued", "scheduled"].includes((state.status ?? "").toLowerCase()),
  );
  const latestSyncAt = syncStateRows.reduce<number | null>((latest, state) => {
    const lastRun = state.last_run_at ? Date.parse(state.last_run_at) : null;
    if (lastRun === null) {
      return latest;
    }
    return latest === null || lastRun > latest ? lastRun : latest;
  }, null);

  const watchlistItemCounts = watchlistItems.reduce<Map<string, number>>((map, item) => {
    map.set(item.watchlist_id, (map.get(item.watchlist_id) ?? 0) + 1);
    return map;
  }, new Map());
  const watchlistCapacity = watchlists.reduce((sum, record) => sum + Number(record.capacity ?? 0), 0);
  const totalWatchlistItems = watchlistItems.length;
  const watchlistUtilization = watchlistCapacity > 0 ? totalWatchlistItems / watchlistCapacity : 0;
  const saturatedWatchlists = watchlists.filter((watchlist) => {
    const capacity = Number(watchlist.capacity ?? 0);
    if (capacity <= 0) {
      return false;
    }
    const usage = watchlistItemCounts.get(watchlist.id) ?? 0;
    return usage >= capacity;
  });
  const nearCapacityWatchlists = watchlists.filter((watchlist) => {
    const capacity = Number(watchlist.capacity ?? 0);
    if (capacity <= 0) {
      return false;
    }
    const usage = watchlistItemCounts.get(watchlist.id) ?? 0;
    return usage / capacity >= 0.8 && usage < capacity;
  });

  const jobLatestRuns = jobRunRows.reduce<Map<string, JobRunRow>>((map, row) => {
    const jobName = row.job_name ?? "unknown";
    if (!map.has(jobName)) {
      map.set(jobName, row);
    }
    return map;
  }, new Map());
  const jobStaleCutoff = now.getTime() - STALE_JOB_THRESHOLD_HOURS * HOURS_TO_MS;
  const failingJobs = Array.from(jobLatestRuns.entries())
    .filter(([_, run]) => ["error", "failed", "fatal", "cancelled", "canceled", "halted"].includes((run.status ?? "").toLowerCase()))
    .map(([name, run]) => ({
      name,
      status: run.status ?? "unknown",
      finishedAt: run.finished_at ?? run.started_at ?? null,
      error: run.error_message ?? null,
    }));
  const staleJobs = Array.from(jobLatestRuns.entries())
    .filter(([_, run]) => {
      const finishedAt = run.finished_at ?? run.started_at;
      const finishedTime = finishedAt ? Date.parse(finishedAt) : null;
      if (finishedTime === null) {
        return true;
      }
      return finishedTime < jobStaleCutoff;
    })
    .map(([name, run]) => ({
      name,
      status: run.status ?? "unknown",
      finishedAt: run.finished_at ?? run.started_at ?? null,
    }));

  const outstandingInvoices = invoiceRows.filter((invoice) => {
    const due = Number(invoice.amount_due_cents ?? 0);
    const paid = Number(invoice.amount_paid_cents ?? 0);
    if (due <= paid) {
      return false;
    }
    const status = (invoice.status ?? "").toLowerCase();
    return !["paid", "void", "draft"].includes(status);
  });
  const outstandingInvoiceTotalCents = outstandingInvoices.reduce((sum, invoice) => {
    const due = Number(invoice.amount_due_cents ?? 0);
    const paid = Number(invoice.amount_paid_cents ?? 0);
    return sum + Math.max(0, due - paid);
  }, 0);
  const oldestOutstandingAt = outstandingInvoices.reduce<number | null>((oldest, invoice) => {
    const invoiceDate = invoice.invoice_date ? Date.parse(invoice.invoice_date) : null;
    if (invoiceDate === null) {
      return oldest;
    }
    return oldest === null || invoiceDate < oldest ? invoiceDate : oldest;
  }, null);

  const webhookBacklog = webhookRows.filter((event) => (event.status ?? "pending").toLowerCase() !== "processed");
  const webhookStaleCutoff = now.getTime() - STALE_WEBHOOK_THRESHOLD_MINUTES * 60 * 1000;
  const staleWebhookEvents = webhookBacklog.filter((event) => {
    const received = event.received_at ? Date.parse(event.received_at) : null;
    if (received === null) {
      return true;
    }
    return received < webhookStaleCutoff;
  });
  const erroredWebhooks = webhookBacklog.filter((event) => (event.status ?? "").toLowerCase() === "error");

  const apiWindowCutoff = now.getTime() - API_HEALTH_WINDOW_HOURS * HOURS_TO_MS;
  const recentApiLogs = apiLogs.filter((log) => {
    if (!log.requested_at) {
      return false;
    }
    const requestedAt = Date.parse(log.requested_at);
    return !Number.isNaN(requestedAt) && requestedAt >= apiWindowCutoff;
  });
  const totalApiRequests = recentApiLogs.length;
  const apiErrorLogs = recentApiLogs.filter((log) => {
    const statusCode = Number(log.status_code ?? 0);
    return statusCode >= 500 || statusCode === 0;
  });
  const slowApiLogs = recentApiLogs.filter((log) => Number(log.latency_ms ?? 0) >= 3000);
  const apiErrorRate = totalApiRequests === 0 ? 0 : apiErrorLogs.length / totalApiRequests;
  const hoursSinceKeywordUpdate = latestKeywordAt
    ? Math.round((now.getTime() - Date.parse(latestKeywordAt)) / HOURS_TO_MS)
    : null;

  const metricsPayload = [
    {
      category: "pipeline",
      metric_key: "keyword_corpus_size",
      metric_label: "Keywords in corpus",
      metric_value: keywordCount,
      metric_unit: "count",
      status: keywordCount >= KEYWORD_CORPUS_TARGET ? "ok" : keywordCount > 0 ? "warning" : "critical",
      delta: null,
      trend: null,
      captured_at: nowIso,
      extras: { target: KEYWORD_CORPUS_TARGET, uniqueMarkets },
    },
    {
      category: "pipeline",
      metric_key: "pending_seed_jobs",
      metric_label: "Pending keyword seeds",
      metric_value: pendingSeeds,
      metric_unit: "count",
      status: pendingSeeds === 0 ? "ok" : pendingSeeds <= 5 ? "warning" : "critical",
      delta: null,
      trend: pendingSeeds === 0 ? "flat" : "up",
      captured_at: nowIso,
      extras: {
        staleSeeds: staleSeeds.length,
        oldestPendingSeedAt: oldestPendingSeedAt ? new Date(oldestPendingSeedAt).toISOString() : null,
        staleThresholdHours: STALE_SEED_THRESHOLD_HOURS,
      },
    },
    {
      category: "pipeline",
      metric_key: "hours_since_keyword_refresh",
      metric_label: "Hours since keyword refresh",
      metric_value: hoursSinceKeywordUpdate,
      metric_unit: "hours",
      status:
        hoursSinceKeywordUpdate === null
          ? "warning"
          : hoursSinceKeywordUpdate <= 6
            ? "ok"
            : hoursSinceKeywordUpdate <= 24
              ? "warning"
              : "critical",
      delta: null,
      trend: null,
      captured_at: nowIso,
      extras: { latestKeywordAt },
    },
    {
      category: "integrations",
      metric_key: "openai_configuration",
      metric_label: "OpenAI integration",
      metric_value: openAIConfigured ? 1 : 0,
      metric_unit: "boolean",
      status: openAIConfigured ? "ok" : "warning",
      delta: null,
      trend: null,
      captured_at: nowIso,
      extras: { configured: openAIConfigured },
    },
    {
      category: "crawlers",
      metric_key: "crawler_sources_reporting",
      metric_label: "Crawler sources reporting",
      metric_value: crawlerRows.length,
      metric_unit: "count",
      status: failingCrawlers.length > 0 ? "critical" : telemetryMissing || staleCrawlers.length > 0 ? "warning" : "ok",
      delta: null,
      trend: null,
      captured_at: nowIso,
      extras: {
        failingSources: limitList(failingCrawlers.map((crawler) => crawler.source)),
        staleSources: limitList(staleCrawlers.map((crawler) => crawler.source)),
        telemetryMissing,
        staleThresholdHours: STALE_CRAWLER_THRESHOLD_HOURS,
        mostRecentRun: mostRecentCrawlerRunAt ? new Date(mostRecentCrawlerRunAt).toISOString() : null,
      },
    },
  ];

  const { data: metricData, error: metricError } = await client
    .from("system_health_metrics")
    .upsert(metricsPayload, { onConflict: "category,metric_key" })
    .select(
      "id,category,metric_key,metric_label,metric_value,metric_unit,status,delta,trend,captured_at,extras",
    );
  if (metricError) {
    throw new Error(`Unable to upsert health metrics: ${metricError.message}`);
  }

  const appetitesPayload = [
    {
      id: APPETITE_DATA_PIPELINE_ID,
      label: "Data pipeline reliability",
      category: "Operations",
      appetite_level: "conservative",
      owner: "Platform Operations",
      tolerance: {
        maxFailingCrawlers: 0,
        staleThresholdHours: STALE_CRAWLER_THRESHOLD_HOURS,
      },
      notes: `Tracking ${crawlerRows.length} crawler sources; ${failingCrawlers.length} failing; ${staleCrawlers.length} stale; telemetry missing: ${telemetryMissing}`,
      updated_at: nowIso,
    },
    {
      id: APPETITE_MARKET_INTELLIGENCE_ID,
      label: "Market intelligence coverage",
      category: "Product",
      appetite_level: "balanced",
      owner: "Product Insights",
      tolerance: {
        minimumKeywordCorpus: KEYWORD_CORPUS_TARGET,
        maximumPendingSeeds: 5,
        staleSeedThresholdHours: STALE_SEED_THRESHOLD_HOURS,
      },
      notes: `Corpus holds ${keywordCount} keywords across ${uniqueMarkets} markets with ${pendingSeeds} seeds pending and ${staleSeeds.length} considered stale.`,
      updated_at: nowIso,
    },
    {
      id: APPETITE_AI_READINESS_ID,
      label: "AI readiness",
      category: "AI Platform",
      appetite_level: openAIConfigured ? "balanced" : "minimal",
      owner: "AI Platform",
      tolerance: {
        requireOpenAIKey: true,
      },
      notes: openAIConfigured
        ? "OPENAI_API_KEY detected; generative features can execute."
        : "OPENAI_API_KEY missing; AI workflows are blocked.",
      updated_at: nowIso,
    },
    {
      id: APPETITE_MARKETPLACE_INTEGRITY_ID,
      label: "Marketplace integration resilience",
      category: "Partner Engineering",
      appetite_level: activeAccounts.length === 0 ? "minimal" : "balanced",
      owner: "Partner Engineering",
      tolerance: {
        minimumActiveAccounts: 1,
        maximumFailingSyncs: 0,
        maximumStaleSyncs: 0,
      },
      notes: `Providers enabled ${enabledProviders.length}/${providerCount}; active accounts ${activeAccounts.length}/${accountCount}; failing syncs ${syncFailing.length}; stale syncs ${syncStale.length}; suspended accounts ${suspendedAccounts.length}.`,
      updated_at: nowIso,
    },
    {
      id: APPETITE_AUTOMATION_UPTIME_ID,
      label: "Automation uptime",
      category: "Operations",
      appetite_level: failingJobs.length > 0 ? "minimal" : staleJobs.length > 0 ? "conservative" : "balanced",
      owner: "Platform Operations",
      tolerance: {
        maximumFailingJobs: 0,
        maximumStaleJobs: 0,
        jobFreshnessHours: STALE_JOB_THRESHOLD_HOURS,
      },
      notes: `${jobLatestRuns.size} jobs observed; failing ${failingJobs.length}; stale ${staleJobs.length}; slow API calls ${slowApiLogs.length}/${totalApiRequests}.`,
      updated_at: nowIso,
    },
    {
      id: APPETITE_BILLING_GOVERNANCE_ID,
      label: "Billing and compliance",
      category: "Finance",
      appetite_level:
        outstandingInvoiceTotalCents >= BILLING_OUTSTANDING_CRITICAL_CENTS || staleWebhookEvents.length > 0
          ? "minimal"
          : outstandingInvoiceTotalCents > 0
            ? "conservative"
            : "balanced",
      owner: "Finance Operations",
      tolerance: {
        maximumOutstandingCents: BILLING_OUTSTANDING_WARNING_CENTS,
        maximumWebhookBacklog: 0,
        webhookStaleMinutes: STALE_WEBHOOK_THRESHOLD_MINUTES,
      },
      notes: `${outstandingInvoices.length} invoices outstanding (${outstandingInvoiceTotalCents} cents), webhook backlog ${webhookBacklog.length} (${staleWebhookEvents.length} stale, ${erroredWebhooks.length} error).`,
      updated_at: nowIso,
    },
  ];

  const { data: appetiteData, error: appetiteError } = await client
    .from("risk_appetites")
    .upsert(appetitesPayload, { onConflict: "id" })
    .select("id,label,category,appetite_level,owner,tolerance,notes,created_at,updated_at");
  if (appetiteError) {
    throw new Error(`Unable to upsert risk appetites: ${appetiteError.message}`);
  }

  const marketplaceControlStatus = activeAccounts.length === 0
    ? "blocked"
    : syncFailing.length > 0
      ? "degraded"
      : syncStale.length > 0 || suspendedAccounts.length > 0 || disabledProviders.length > 0
        ? "warning"
        : "active";
  const automationControlStatus = failingJobs.length > 0 ? "degraded" : staleJobs.length > 0 ? "warning" : "active";
  const apiControlStatus =
    apiErrorRate >= API_ERROR_RATE_CRITICAL
      ? "degraded"
      : apiErrorRate >= API_ERROR_RATE_WARNING || slowApiLogs.length > 0
        ? "warning"
        : "active";
  const billingControlStatus =
    outstandingInvoiceTotalCents >= BILLING_OUTSTANDING_CRITICAL_CENTS || staleWebhookEvents.length > 0
      ? "degraded"
      : outstandingInvoiceTotalCents > 0 || webhookBacklog.length > 0
        ? "warning"
        : "active";

  const controlPayload = [
    {
      id: CONTROL_CRAWLER_OBSERVABILITY_ID,
      name: "Crawler telemetry observability",
      description: "Monitors crawler_statuses for failures and stale telemetry windows.",
      owner: "Data Platform",
      status: failingCrawlers.length > 0 ? "degraded" : telemetryMissing ? "blocked" : staleCrawlers.length > 0 ? "warning" : "active",
      coverage_area: "Crawler ingestion",
      metadata: {
        failingSources: limitList(failingCrawlers.map((crawler) => crawler.source)),
        staleSources: limitList(staleCrawlers.map((crawler) => crawler.source)),
        telemetryMissing,
        staleThresholdHours: STALE_CRAWLER_THRESHOLD_HOURS,
      },
      updated_at: nowIso,
    },
    {
      id: CONTROL_SEED_ROTATION_ID,
      name: "Seed rotation pipeline",
      description: "Schedules keyword seed refresh jobs and tracks pending backlog.",
      owner: "Marketplace Operations",
      status:
        pendingSeeds === 0
          ? "active"
          : staleSeeds.length > 0
            ? "needs-attention"
            : "in-review",
      coverage_area: "Keyword ingestion",
      metadata: {
        pendingSeeds,
        staleSeedTerms: limitList(staleSeeds.map((seed) => seed.term ?? "")),
        staleSeedThresholdHours: STALE_SEED_THRESHOLD_HOURS,
        oldestPendingSeedAt: oldestPendingSeedAt ? new Date(oldestPendingSeedAt).toISOString() : null,
      },
      updated_at: nowIso,
    },
    {
      id: CONTROL_AI_INTEGRATIONS_ID,
      name: "AI integration readiness",
      description: "Validates AI credentials and toggles workflow availability.",
      owner: "AI Platform",
      status: openAIConfigured ? "active" : "blocked",
      coverage_area: "AI platform",
      metadata: { openAIConfigured },
      updated_at: nowIso,
    },
    {
      id: CONTROL_MARKETPLACE_SYNCS_ID,
      name: "Marketplace sync monitoring",
      description: "Watches marketplace accounts and sync jobs for failures or stale runs.",
      owner: "Partner Engineering",
      status: marketplaceControlStatus,
      coverage_area: "Marketplace integrations",
      metadata: {
        enabledProviders: enabledProviders.length,
        providerCount,
        activeAccounts: activeAccounts.length,
        accountCount,
        failingSyncs: limitList(syncFailing.map((state) => state.sync_type ?? state.id)),
        staleSyncs: limitList(syncStale.map((state) => state.sync_type ?? state.id)),
        suspendedAccounts: limitList(suspendedAccounts.map((account) => account.provider_id ?? account.id)),
        disabledProviders: disabledProviderLabels,
        latestSyncAt: latestSyncAt ? new Date(latestSyncAt).toISOString() : null,
        saturatedWatchlists: limitList(
          saturatedWatchlists.map((watchlist) => watchlist.id),
        ),
        watchlistUtilization,
      },
      updated_at: nowIso,
    },
    {
      id: CONTROL_JOB_AUTOMATION_ID,
      name: "Background job runbook",
      description: "Tracks background job executions and flags failures or stale runs.",
      owner: "Platform Operations",
      status: automationControlStatus,
      coverage_area: "Automation",
      metadata: {
        failingJobs: failingJobs,
        staleJobs: staleJobs,
        jobCount: jobLatestRuns.size,
        jobStaleThresholdHours: STALE_JOB_THRESHOLD_HOURS,
      },
      updated_at: nowIso,
    },
    {
      id: CONTROL_API_HEALTH_ID,
      name: "API guardrails",
      description: "Monitors API error rate and latency for partner integrations.",
      owner: "Platform Operations",
      status: apiControlStatus,
      coverage_area: "API platform",
      metadata: {
        totalApiRequests,
        apiErrorRate,
        errorCount: apiErrorLogs.length,
        slowRequests: slowApiLogs.length,
        windowHours: API_HEALTH_WINDOW_HOURS,
      },
      updated_at: nowIso,
    },
    {
      id: CONTROL_BILLING_INCIDENTS_ID,
      name: "Billing incident response",
      description: "Escalates outstanding invoices, webhook backlogs, and payment exceptions.",
      owner: "Finance Operations",
      status: billingControlStatus,
      coverage_area: "Billing",
      metadata: {
        outstandingInvoices: outstandingInvoices.length,
        outstandingTotalCents: outstandingInvoiceTotalCents,
        oldestOutstandingAt: oldestOutstandingAt ? new Date(oldestOutstandingAt).toISOString() : null,
        webhookBacklog: webhookBacklog.length,
        staleWebhookEvents: staleWebhookEvents.length,
        erroredWebhooks: erroredWebhooks.length,
      },
      updated_at: nowIso,
    },
  ];

  const { data: controlData, error: controlError } = await client
    .from("risk_controls")
    .upsert(controlPayload, { onConflict: "id" })
    .select("id,name,description,owner,status,coverage_area,metadata,created_at,updated_at");
  if (controlError) {
    throw new Error(`Unable to upsert risk controls: ${controlError.message}`);
  }

  const managedRiskIds = [
    RISK_CRAWLER_GAPS_ID,
    RISK_KEYWORD_COVERAGE_ID,
    RISK_AI_CONFIGURATION_ID,
    RISK_MARKETPLACE_SYNC_ID,
    RISK_BACKGROUND_JOBS_ID,
    RISK_API_ERROR_RATE_ID,
    RISK_BILLING_EXCEPTIONS_ID,
  ];
  const { data: existingRegisterRows, error: existingRegisterError } = await client
    .from("risk_register_entries")
    .select("id,raised_at,status")
    .in("id", managedRiskIds);
  if (existingRegisterError) {
    throw new Error(`Unable to load existing risk entries: ${existingRegisterError.message}`);
  }

  const existingRegisterMap = new Map<string, ExistingRegisterRow>(
    ((existingRegisterRows ?? []) as ExistingRegisterRow[]).map((row) => [row.id, row]),
  );

  const crawlerIssue = telemetryMissing || failingCrawlers.length > 0 || staleCrawlers.length > 0;
  const crawlerSeverity = failingCrawlers.length > 0 || telemetryMissing ? "high" : staleCrawlers.length > 0 ? "medium" : "low";
  const crawlerLikelihood = failingCrawlers.length > 0 || telemetryMissing ? "likely" : staleCrawlers.length > 0 ? "possible" : "unlikely";
  const crawlerImpact = failingCrawlers.length > 0 || telemetryMissing ? "major" : staleCrawlers.length > 0 ? "moderate" : "minor";
  const crawlerSummaryParts: string[] = [];
  if (telemetryMissing) {
    crawlerSummaryParts.push("No crawler telemetry has been recorded yet.");
  }
  if (failingCrawlers.length > 0) {
    crawlerSummaryParts.push(`Failing sources: ${limitList(failingCrawlers.map((crawler) => crawler.source)).join(", ")}.`);
  }
  if (staleCrawlers.length > 0) {
    crawlerSummaryParts.push(
      `Stale sources (> ${STALE_CRAWLER_THRESHOLD_HOURS}h): ${limitList(staleCrawlers.map((crawler) => crawler.source)).join(", ")}.`,
    );
  }
  const crawlerSummary =
    crawlerSummaryParts.length > 0
      ? crawlerSummaryParts.join(" ")
      : "Crawler telemetry is reporting within the configured tolerance window.";

  const keywordIssue = keywordCount < KEYWORD_CORPUS_TARGET || staleSeeds.length > 0;
  const keywordSeverity = keywordCount === 0 ? "high" : keywordCount < KEYWORD_CORPUS_TARGET ? "medium" : "low";
  const keywordLikelihood = keywordCount === 0 ? "likely" : keywordIssue ? "possible" : "unlikely";
  const keywordImpact = keywordCount === 0 ? "major" : keywordCount < KEYWORD_CORPUS_TARGET ? "moderate" : "minor";
  const keywordSummary = keywordIssue
    ? `Corpus contains ${keywordCount} keywords across ${uniqueMarkets} markets (target ${KEYWORD_CORPUS_TARGET}). ${pendingSeeds} seeds pending, ${staleSeeds.length} stale beyond ${STALE_SEED_THRESHOLD_HOURS}h.`
    : `Corpus contains ${keywordCount} keywords across ${uniqueMarkets} markets (target ${KEYWORD_CORPUS_TARGET}).`;

  const aiIssue = !openAIConfigured;

  const marketplaceIssue =
    activeAccounts.length === 0 || syncFailing.length > 0 || syncStale.length > 0 || disabledProviders.length > 0;
  const marketplaceSeverity = activeAccounts.length === 0 || syncFailing.length > 1 ? "high" : marketplaceIssue ? "medium" : "low";
  const marketplaceLikelihood =
    activeAccounts.length === 0 || syncFailing.length > 0 ? "likely" : syncStale.length > 0 ? "possible" : "unlikely";
  const marketplaceImpact = activeAccounts.length === 0 || syncFailing.length > 0 ? "major" : marketplaceIssue ? "moderate" : "minor";
  const marketplaceSummaryParts: string[] = [];
  marketplaceSummaryParts.push(
    `${activeAccounts.length}/${accountCount} marketplace accounts active; ${enabledProviders.length}/${providerCount} providers enabled.`,
  );
  if (disabledProviders.length > 0) {
    marketplaceSummaryParts.push(`Disabled providers: ${disabledProviderLabels.join(", ") || disabledProviders.length}.`);
  }
  if (syncFailing.length > 0) {
    marketplaceSummaryParts.push(
      `Failing syncs: ${limitList(syncFailing.map((state) => state.sync_type ?? state.id)).join(", ")}.`,
    );
  }
  if (syncStale.length > 0) {
    marketplaceSummaryParts.push(
      `Stale syncs (> ${STALE_SYNC_THRESHOLD_HOURS}h): ${limitList(syncStale.map((state) => state.sync_type ?? state.id)).join(", ")}.`,
    );
  }
  if (suspendedAccounts.length > 0) {
    marketplaceSummaryParts.push(
      `Suspended accounts: ${limitList(suspendedAccounts.map((account) => account.provider_id ?? account.id)).join(", ")}.`,
    );
  }
  if (saturatedWatchlists.length > 0 || nearCapacityWatchlists.length > 0) {
    marketplaceSummaryParts.push(
      `${saturatedWatchlists.length} watchlists at capacity, ${nearCapacityWatchlists.length} nearing limit (${Math.round(watchlistUtilization * 100)}% utilization).`,
    );
  }
  const marketplaceSummary = marketplaceSummaryParts.join(" ");

  const jobIssue = jobLatestRuns.size === 0 || failingJobs.length > 0 || staleJobs.length > 0;
  const jobSeverity = failingJobs.length > 0 || jobLatestRuns.size === 0 ? "high" : staleJobs.length > 0 ? "medium" : "low";
  const jobLikelihood = failingJobs.length > 0 || jobLatestRuns.size === 0 ? "likely" : staleJobs.length > 0 ? "possible" : "unlikely";
  const jobImpact = failingJobs.length > 0 ? "major" : staleJobs.length > 0 ? "moderate" : jobLatestRuns.size === 0 ? "major" : "minor";
  const jobSummaryParts: string[] = [];
  if (jobLatestRuns.size === 0) {
    jobSummaryParts.push("No job executions recorded yet.");
  } else {
    jobSummaryParts.push(`${jobLatestRuns.size} background jobs tracked.`);
  }
  if (failingJobs.length > 0) {
    jobSummaryParts.push(
      `Failing jobs: ${limitList(failingJobs.map((job) => `${job.name} (${job.status})`)).join(", ")}.`,
    );
  }
  if (staleJobs.length > 0) {
    jobSummaryParts.push(
      `Stale jobs (> ${STALE_JOB_THRESHOLD_HOURS}h): ${limitList(staleJobs.map((job) => job.name)).join(", ")}.`,
    );
  }
  const jobSummary = jobSummaryParts.join(" ");

  const apiIssue = apiErrorRate >= API_ERROR_RATE_WARNING || slowApiLogs.length > 0;
  const apiSeverity = apiErrorRate >= API_ERROR_RATE_CRITICAL ? "high" : apiErrorRate >= API_ERROR_RATE_WARNING ? "medium" : "low";
  const apiLikelihood = apiErrorRate >= API_ERROR_RATE_WARNING ? "likely" : slowApiLogs.length > 0 ? "possible" : "unlikely";
  const apiImpact = apiErrorRate >= API_ERROR_RATE_CRITICAL ? "major" : apiErrorRate >= API_ERROR_RATE_WARNING ? "moderate" : slowApiLogs.length > 0 ? "minor" : "minor";
  const apiSummary = apiIssue
    ? `${apiErrorLogs.length}/${totalApiRequests} requests errored (${Math.round(apiErrorRate * 100)}%); ${slowApiLogs.length} slow requests >=3s.`
    : `API error rate ${Math.round(apiErrorRate * 100)}% over ${totalApiRequests} requests.`;

  const billingIssue =
    outstandingInvoiceTotalCents > 0 || webhookBacklog.length > 0 || erroredWebhooks.length > 0 || staleWebhookEvents.length > 0;
  const billingSeverity =
    outstandingInvoiceTotalCents >= BILLING_OUTSTANDING_CRITICAL_CENTS || erroredWebhooks.length > 0
      ? "high"
      : outstandingInvoiceTotalCents > 0 || staleWebhookEvents.length > 0
        ? "medium"
        : billingIssue
          ? "low"
          : "low";
  const billingLikelihood = billingIssue
    ? outstandingInvoiceTotalCents > 0 || erroredWebhooks.length > 0
      ? "likely"
      : "possible"
    : "unlikely";
  const billingImpact =
    outstandingInvoiceTotalCents >= BILLING_OUTSTANDING_CRITICAL_CENTS
      ? "major"
      : outstandingInvoiceTotalCents > 0 || staleWebhookEvents.length > 0
        ? "moderate"
        : billingIssue
          ? "minor"
          : "minor";
  const billingSummaryParts: string[] = [];
  billingSummaryParts.push(
    `${outstandingInvoices.length} invoices outstanding totaling ${outstandingInvoiceTotalCents} cents (${oldestOutstandingAt ? `oldest ${new Date(oldestOutstandingAt).toISOString()}` : "no invoice date"}).`,
  );
  if (webhookBacklog.length > 0) {
    billingSummaryParts.push(
      `Webhook backlog ${webhookBacklog.length} (${staleWebhookEvents.length} stale, ${erroredWebhooks.length} errors).`,
    );
  }
  const billingSummary = billingSummaryParts.join(" ");

  const registerPayload = [
    {
      id: RISK_CRAWLER_GAPS_ID,
      title: "Crawler telemetry gaps",
      summary: crawlerSummary,
      status: crawlerIssue ? "open" : "closed",
      severity: crawlerSeverity,
      likelihood: crawlerLikelihood,
      impact: crawlerImpact,
      owner: "Data Platform",
      appetite_id: APPETITE_DATA_PIPELINE_ID,
      control_id: CONTROL_CRAWLER_OBSERVABILITY_ID,
      mitigation:
        "Re-run failing crawler jobs, inspect error payloads, and ensure telemetry webhooks are delivering updates.",
      follow_up: "Verify each crawler's scheduling metadata after remediation and capture a post-mortem summary.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_CRAWLER_GAPS_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && crawlerIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: crawlerIssue ? addDays(1, now) : null,
      resolved_at: crawlerIssue ? null : nowIso,
      metadata: {
        failingSources: limitList(failingCrawlers.map((crawler) => crawler.source)),
        staleSources: limitList(staleCrawlers.map((crawler) => crawler.source)),
        telemetryMissing,
        totalSources: crawlerRows.map((crawler) => crawler.source),
        staleThresholdHours: STALE_CRAWLER_THRESHOLD_HOURS,
        mostRecentRun: mostRecentCrawlerRunAt ? new Date(mostRecentCrawlerRunAt).toISOString() : null,
      },
      updated_at: nowIso,
    },
    {
      id: RISK_KEYWORD_COVERAGE_ID,
      title: "Keyword corpus coverage",
      summary: keywordSummary,
      status: keywordIssue ? "open" : "closed",
      severity: keywordSeverity,
      likelihood: keywordLikelihood,
      impact: keywordImpact,
      owner: "Product Insights",
      appetite_id: APPETITE_MARKET_INTELLIGENCE_ID,
      control_id: CONTROL_SEED_ROTATION_ID,
      mitigation:
        "Run the seed rotation job, prioritize stale terms, and backfill missing keyword records for high-priority markets.",
      follow_up:
        "Audit the seed backlog after refresh, confirm coverage against the corpus target, and document remaining gaps.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_KEYWORD_COVERAGE_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && keywordIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: keywordIssue ? addDays(keywordCount === 0 ? 1 : 3, now) : null,
      resolved_at: keywordIssue ? null : nowIso,
      metadata: {
        keywordCount,
        keywordTarget: KEYWORD_CORPUS_TARGET,
        uniqueMarkets,
        pendingSeeds,
        staleSeedCount: staleSeeds.length,
        staleSeedTerms: limitList(staleSeeds.map((seed) => seed.term ?? "")),
        staleSeedThresholdHours: STALE_SEED_THRESHOLD_HOURS,
        oldestPendingSeedAt: oldestPendingSeedAt ? new Date(oldestPendingSeedAt).toISOString() : null,
        latestKeywordAt,
        hoursSinceKeywordUpdate,
      },
      updated_at: nowIso,
    },
    {
      id: RISK_AI_CONFIGURATION_ID,
      title: "AI integration configuration",
      summary: aiIssue
        ? "OPENAI_API_KEY is not configured; generative workflows and AI scoring remain disabled."
        : "OPENAI_API_KEY detected; AI workflows are able to execute.",
      status: aiIssue ? "open" : "closed",
      severity: aiIssue ? "medium" : "low",
      likelihood: aiIssue ? "likely" : "unlikely",
      impact: aiIssue ? "moderate" : "minor",
      owner: "AI Platform",
      appetite_id: APPETITE_AI_READINESS_ID,
      control_id: CONTROL_AI_INTEGRATIONS_ID,
      mitigation: "Provision the OpenAI API key in the runtime environment and re-run smoke tests.",
      follow_up: "Document the credential rotation policy and verify model availability after the key is applied.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_AI_CONFIGURATION_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && aiIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: aiIssue ? addDays(2, now) : null,
      resolved_at: aiIssue ? null : nowIso,
      metadata: { openAIConfigured, required: true },
      updated_at: nowIso,
    },
    {
      id: RISK_MARKETPLACE_SYNC_ID,
      title: "Marketplace sync degradation",
      summary: marketplaceSummary,
      status: marketplaceIssue ? "open" : "closed",
      severity: marketplaceSeverity,
      likelihood: marketplaceLikelihood,
      impact: marketplaceImpact,
      owner: "Partner Engineering",
      appetite_id: APPETITE_MARKETPLACE_INTEGRITY_ID,
      control_id: CONTROL_MARKETPLACE_SYNCS_ID,
      mitigation: "Audit failing sync jobs, re-authorize suspended accounts, and coordinate provider enablement.",
      follow_up: "Confirm sync jobs resume within the freshness window and update integration runbooks.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_MARKETPLACE_SYNC_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && marketplaceIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: marketplaceIssue ? addDays(2, now) : null,
      resolved_at: marketplaceIssue ? null : nowIso,
      metadata: {
        activeAccounts: activeAccounts.length,
        accountCount,
        enabledProviders: enabledProviders.length,
        providerCount,
        failingSyncs: limitList(syncFailing.map((state) => state.sync_type ?? state.id)),
        staleSyncs: limitList(syncStale.map((state) => state.sync_type ?? state.id)),
        suspendedAccounts: limitList(suspendedAccounts.map((account) => account.provider_id ?? account.id)),
        disabledProviders: disabledProviderLabels,
        latestSyncAt: latestSyncAt ? new Date(latestSyncAt).toISOString() : null,
        watchlistUtilization,
      },
      updated_at: nowIso,
    },
    {
      id: RISK_BACKGROUND_JOBS_ID,
      title: "Background job backlog",
      summary: jobSummary,
      status: jobIssue ? "open" : "closed",
      severity: jobSeverity,
      likelihood: jobLikelihood,
      impact: jobImpact,
      owner: "Platform Operations",
      appetite_id: APPETITE_AUTOMATION_UPTIME_ID,
      control_id: CONTROL_JOB_AUTOMATION_ID,
      mitigation: "Investigate job logs, replay failed runs, and ensure schedules are restored.",
      follow_up: "Document remediation, capture error context, and validate downstream data completeness.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_BACKGROUND_JOBS_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && jobIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: jobIssue ? addDays(1, now) : null,
      resolved_at: jobIssue ? null : nowIso,
      metadata: {
        failingJobs,
        staleJobs,
        jobCount: jobLatestRuns.size,
        jobStaleThresholdHours: STALE_JOB_THRESHOLD_HOURS,
      },
      updated_at: nowIso,
    },
    {
      id: RISK_API_ERROR_RATE_ID,
      title: "API error rate spike",
      summary: apiSummary,
      status: apiIssue ? "open" : "closed",
      severity: apiSeverity,
      likelihood: apiLikelihood,
      impact: apiImpact,
      owner: "Platform Operations",
      appetite_id: APPETITE_AUTOMATION_UPTIME_ID,
      control_id: CONTROL_API_HEALTH_ID,
      mitigation: "Inspect failing API routes, roll back breaking changes, and add regression tests.",
      follow_up: "Publish a post-incident summary with error rates and confirm latency has normalized.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_API_ERROR_RATE_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && apiIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: apiIssue ? addDays(1, now) : null,
      resolved_at: apiIssue ? null : nowIso,
      metadata: {
        totalApiRequests,
        apiErrorRate,
        errorCount: apiErrorLogs.length,
        slowRequests: slowApiLogs.length,
        windowHours: API_HEALTH_WINDOW_HOURS,
      },
      updated_at: nowIso,
    },
    {
      id: RISK_BILLING_EXCEPTIONS_ID,
      title: "Billing and webhook exceptions",
      summary: billingSummary,
      status: billingIssue ? "open" : "closed",
      severity: billingSeverity,
      likelihood: billingLikelihood,
      impact: billingImpact,
      owner: "Finance Operations",
      appetite_id: APPETITE_BILLING_GOVERNANCE_ID,
      control_id: CONTROL_BILLING_INCIDENTS_ID,
      mitigation: "Settle outstanding invoices, replay webhook deliveries, and coordinate with providers on failures.",
      follow_up: "Reconcile invoice ledger after remediation and confirm webhook queue is empty.",
      raised_by: "system",
      raised_at: (() => {
        const existing = existingRegisterMap.get(RISK_BILLING_EXCEPTIONS_ID);
        if (!existing) {
          return nowIso;
        }
        if (existing.status === "closed" && billingIssue) {
          return nowIso;
        }
        return existing.raised_at ?? nowIso;
      })(),
      due_at: billingIssue ? addDays(3, now) : null,
      resolved_at: billingIssue ? null : nowIso,
      metadata: {
        outstandingInvoices: outstandingInvoices.length,
        outstandingTotalCents: outstandingInvoiceTotalCents,
        oldestOutstandingAt: oldestOutstandingAt ? new Date(oldestOutstandingAt).toISOString() : null,
        webhookBacklog: webhookBacklog.length,
        staleWebhookEvents: staleWebhookEvents.length,
        erroredWebhooks: erroredWebhooks.length,
      },
      updated_at: nowIso,
    },
  ];

  const { data: registerData, error: registerError } = await client
    .from("risk_register_entries")
    .upsert(registerPayload, { onConflict: "id" })
    .select(
      "id,title,summary,status,severity,likelihood,impact,owner,appetite_id,control_id,mitigation,follow_up,raised_by,raised_at,due_at,resolved_at,metadata,created_at,updated_at",
    );
  if (registerError) {
    throw new Error(`Unable to upsert risk register entries: ${registerError.message}`);
  }

  return {
    appetites: (appetiteData ?? []) as RiskAppetite[],
    controls: (controlData ?? []) as RiskControl[],
    register: (registerData ?? []) as RiskRegisterEntry[],
    metrics: (metricData ?? []) as HealthMetric[],
  };
}
