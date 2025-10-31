import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { HealthMetric } from "@/lib/backoffice/status";

import type { RiskAppetite, RiskControl, RiskRegisterEntry } from "./service";

const STALE_CRAWLER_THRESHOLD_HOURS = 6;
const STALE_SEED_THRESHOLD_HOURS = 12;
const KEYWORD_CORPUS_TARGET = 200;

const APPETITE_DATA_PIPELINE_ID = "b9effbf9-9dc7-469c-bda2-da2ecebd2e4f";
const APPETITE_MARKET_INTELLIGENCE_ID = "519ce5f9-070a-41e6-b165-5471d6eff1e4";
const APPETITE_AI_READINESS_ID = "f03569e9-a809-4b3c-be09-6cea0ec8f1d1";

const CONTROL_CRAWLER_OBSERVABILITY_ID = "f122a20a-1a42-4c76-ba28-4a38344a9534";
const CONTROL_SEED_ROTATION_ID = "4cdca7c9-3120-4a37-b240-883f5b945bb4";
const CONTROL_AI_INTEGRATIONS_ID = "a8e17080-7ef7-4357-a9ac-785579ab39a3";

const RISK_CRAWLER_GAPS_ID = "01c8f68d-0ecb-451e-a19a-e26eb97d9803";
const RISK_KEYWORD_COVERAGE_ID = "11c85cf4-f0a3-4357-a521-cbfbb4170ba9";
const RISK_AI_CONFIGURATION_ID = "a7a3f46c-587d-443a-af7e-49222ee23d91";

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

  const [keywordCountResp, keywordMarketsResp, latestKeywordResp, seedRowsResp, crawlerRowsResp] =
    await Promise.all([
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
  ];

  const { data: appetiteData, error: appetiteError } = await client
    .from("risk_appetites")
    .upsert(appetitesPayload, { onConflict: "id" })
    .select("id,label,category,appetite_level,owner,tolerance,notes,created_at,updated_at");
  if (appetiteError) {
    throw new Error(`Unable to upsert risk appetites: ${appetiteError.message}`);
  }

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
