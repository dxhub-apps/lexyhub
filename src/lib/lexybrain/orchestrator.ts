import { createHash } from "crypto";
import { createSemanticEmbedding } from "@/lib/ai/semantic-embeddings";
import { logger } from "@/lib/logger";
import { generateLexyBrainJson } from "@/lib/lexybrain-json";
import type { LexyBrainContext } from "@/lib/lexybrain-prompt";
import type { LexyBrainOutput, LexyBrainOutputType } from "@/lib/lexybrain-schemas";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/* ----------------------------- Types & Config ----------------------------- */

export type LexyBrainCapability =
  | "keyword_insights"
  | "market_brief"
  | "competitor_intel"
  | "alert_explanation"
  | "recommendations"
  | "compliance_check"
  | "support_docs"
  | "ask_anything"
  | "intent_classification"
  | "cluster_labeling";

export interface LexyBrainOrchestrationRequest {
  capability: LexyBrainCapability;
  userId: string;
  keywordIds?: string[];
  query?: string | null;
  marketplace?: string | null;
  language?: string | null;
  scope?: "user" | "team" | "global";
  metadata?: Record<string, unknown>;
}

export interface LexyBrainOrchestrationResult {
  capability: LexyBrainCapability;
  outputType: LexyBrainOutputType;
  insight: LexyBrainOutput;
  metrics: Record<string, unknown>;
  references: Array<{
    type: string;
    id: string;
    scope?: string | null;
    score?: number | null;
    extra?: Record<string, unknown>;
  }>;
  llama: {
    modelVersion: string;
    latencyMs: number;
    promptTokens: number;
    outputTokens: number;
  };
  snapshot?: {
    ids: string[];
  };
}

type CapabilityConfig = {
  outputType: LexyBrainOutputType;
  promptKey: string;
  defaultScope: "user" | "team" | "global";
  maxContext: number;
};

const CAPABILITY_CONFIG: Record<LexyBrainCapability, CapabilityConfig> = {
  keyword_insights: { outputType: "market_brief", promptKey: "keyword_insights_v1", defaultScope: "user", maxContext: 12 },
  market_brief: { outputType: "market_brief", promptKey: "market_brief_v1", defaultScope: "user", maxContext: 12 },
  competitor_intel: { outputType: "radar", promptKey: "competitor_intel_v1", defaultScope: "team", maxContext: 16 },
  alert_explanation: { outputType: "risk", promptKey: "alert_explanation_v1", defaultScope: "user", maxContext: 10 },
  recommendations: { outputType: "market_brief", promptKey: "keyword_insights_v1", defaultScope: "user", maxContext: 12 },
  compliance_check: { outputType: "risk", promptKey: "alert_explanation_v1", defaultScope: "team", maxContext: 10 },
  support_docs: { outputType: "market_brief", promptKey: "market_brief_v1", defaultScope: "global", maxContext: 8 },
  ask_anything: { outputType: "market_brief", promptKey: "ask_anything_v1", defaultScope: "user", maxContext: 12 },
  intent_classification: { outputType: "market_brief", promptKey: "intent_classification_v1", defaultScope: "global", maxContext: 0 },
  cluster_labeling: { outputType: "market_brief", promptKey: "cluster_labeling_v1", defaultScope: "global", maxContext: 0 },
};

type KeywordRecord = {
  id: string;
  term: string;
  market: string | null;
  demand_index: number | null;
  competition_score: number | null;
  trend_momentum: number | null;
  engagement_score: number | null;
  ai_opportunity_score: number | null;
  extras?: Record<string, unknown> | null;
};

type CorpusChunk = {
  id: string;
  owner_scope: string;
  owner_user_id: string | null;
  source_type: string;
  source_ref: Record<string, unknown> | null;
  marketplace: string | null;
  language: string | null;
  chunk: string;
  metadata: Record<string, unknown> | null;
  combined_score: number | null;
  lexical_rank: number | null;
  vector_rank: number | null;
};

/* ----------------------------- Utils ----------------------------- */

function hashReference(parts: Array<string | number | null | undefined>): string {
  const h = createHash("sha256");
  h.update(parts.map((part) => (part ?? "null").toString()).join("|"));
  return h.digest("hex");
}

function toReferencePart(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value);
}

/** Canonicalize marketplace across ingestion and retrieval */
export function normalizeMarketplace(m?: string | null, src?: string | null): string | null {
  const s = (m ?? "").toLowerCase().trim();
  const source = (src ?? "").toLowerCase();

  if (!s) {
    if (source.startsWith("dataforseo")) return "google";
    return null;
  }

  if (["us", "usa", "google-us", "google_us", "google:us"].includes(s)) return "google";
  if (["etsy-us", "etsy_us", "etsy:us"].includes(s)) return "etsy";
  if (["amazon-us", "amazon_us", "amazon:us"].includes(s)) return "amazon";
  if (["shopify-us", "shopify_us"].includes(s)) return "shopify";
  return s;
}

/* ----------------------------- Data Access ----------------------------- */

async function fetchUserProfile(userId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, plan, trial_expires_at, extension_trial_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logger.warn({ type: "lexybrain_profile_fetch_error", error: error.message }, "Failed to load user profile");
    return null;
  }
  return (data as Record<string, unknown>) ?? null;
}

async function fetchKeywords(keywordIds: string[]): Promise<KeywordRecord[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || keywordIds.length === 0) return [];

  const { data, error } = await supabase
    .from("keywords")
    .select(
      "id, term, market, demand_index, competition_score, trend_momentum, engagement_score, ai_opportunity_score, extras"
    )
    .in("id", keywordIds);

  if (error) {
    logger.error({ type: "lexybrain_keyword_fetch_error", error: error.message }, "Failed to load keywords");
    return [];
  }

  const keywords = (data ?? []) as KeywordRecord[];

  // Opportunistic enrichment from DataForSEO extras
  return keywords.map((keyword) => {
    const extras = keyword.extras as Record<string, any> | null;
    const dataforSEOData = extras?.dataforseo;

    if (dataforSEOData && typeof dataforSEOData === "object") {
      if (keyword.demand_index == null) {
        const searchVolume = dataforSEOData.search_volume || dataforSEOData.monthly_searches?.[0]?.search_volume;
        if (typeof searchVolume === "number") {
          keyword.demand_index = Math.min(searchVolume / 100000, 1);
          logger.info(
            {
              type: "lexybrain_keyword_enriched",
              keyword_id: keyword.id,
              term: keyword.term,
              source: "dataforseo_extras",
              search_volume: searchVolume,
              normalized_demand: keyword.demand_index,
            },
            "Enriched keyword metrics from DataForSEO data"
          );
        }
      }
      if (keyword.competition_score == null) {
        const competition = dataforSEOData.competition ?? dataforSEOData.competition_index;
        if (competition != null) {
          keyword.competition_score = typeof competition === "number" ? competition : parseFloat(competition);
        }
      }
    }

    // Normalize market at read time for robustness
    const maybeSource = typeof extras?.source === "string" ? (extras?.source as string) : null;
    keyword.market = normalizeMarketplace(keyword.market, maybeSource);

    return keyword;
  });
}

async function fetchKeywordMetrics(keywordIds: string[]): Promise<Record<string, unknown>> {
  const supabase = getSupabaseServerClient();
  if (!supabase || keywordIds.length === 0) return { daily: [], weekly: [] };

  const { data: daily, error: dailyError } = await supabase
    .from("keyword_metrics_daily")
    .select("keyword_id, collected_on, volume, competition_score, engagement, social_mentions, social_sentiment")
    .in("keyword_id", keywordIds)
    .gte("collected_on", new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString())
    .order("collected_on", { ascending: false });

  if (dailyError) {
    logger.warn({ type: "lexybrain_metrics_daily_error", error: dailyError.message }, "Failed to load daily metrics");
  }

  const { data: weekly, error: weeklyError } = await supabase
    .from("keyword_metrics_weekly")
    .select("keyword_id, week_start, source, metrics")
    .in("keyword_id", keywordIds)
    .order("week_start", { ascending: false })
    .limit(52);

  if (weeklyError) {
    logger.warn({ type: "lexybrain_metrics_weekly_error", error: weeklyError.message }, "Failed to load weekly metrics");
  }

  return { daily: daily ?? [], weekly: weekly ?? [] };
}

async function fetchPredictions(keywordIds: string[], marketplace: string | null): Promise<Record<string, unknown>[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || keywordIds.length === 0) return [];

  const query = supabase
    .from("keyword_predictions")
    .select("keyword_id, marketplace, horizon, metrics, created_at")
    .in("keyword_id", keywordIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (marketplace) query.eq("marketplace", marketplace);

  const { data, error } = await query;
  if (error) {
    logger.warn({ type: "lexybrain_predictions_error", error: error.message }, "Failed to load keyword predictions");
    return [];
  }
  return data ?? [];
}

async function fetchRiskSignals(
  keywordIds: string[],
  marketplace: string | null
): Promise<{ rules: Record<string, unknown>[]; events: Record<string, unknown>[] }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { rules: [], events: [] };

  const rulesQuery = supabase
    .from("risk_rules")
    .select("id, rule_code, description, marketplace, severity, metadata, created_at");

  if (marketplace) {
    rulesQuery.or(`marketplace.is.null,marketplace.eq.${marketplace}`);
  }

  const { data: rules, error: rulesError } = await rulesQuery;
  if (rulesError) {
    logger.warn({ type: "lexybrain_risk_rules_error", error: rulesError.message }, "Failed to load risk rules");
  }

  const eventsQuery = supabase
    .from("risk_events")
    .select("id, keyword_id, rule_id, marketplace, occurred_at, details, scope")
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (keywordIds.length > 0) eventsQuery.in("keyword_id", keywordIds);
  if (marketplace) eventsQuery.or(`marketplace.is.null,marketplace.eq.${marketplace}`);

  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) {
    logger.warn({ type: "lexybrain_risk_events_error", error: eventsError.message }, "Failed to load risk events");
  }

  return { rules: rules ?? [], events: events ?? [] };
}

/* ----------------------------- Retrieval ----------------------------- */

async function retrieveCorpusContext(params: {
  queryText: string;
  capability: LexyBrainCapability;
  marketplace: string | null;
  language: string | null;
  limit: number;
}): Promise<CorpusChunk[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const trimmedQuery = params.queryText.trim();
  const embedding = trimmedQuery ? await createSemanticEmbedding(trimmedQuery) : null;

  logger.info(
    {
      type: "lexybrain_rrf_search_call",
      capability: params.capability,
      marketplace: params.marketplace,
      language: params.language,
      query_length: trimmedQuery.length,
      has_embedding: !!embedding,
      limit: params.limit,
    },
    "Calling ai_corpus_rrf_search RPC"
  );

  const { data, error } = await supabase.rpc("ai_corpus_rrf_search", {
    p_query: trimmedQuery || null,
    p_query_embedding: embedding,
    p_capability: params.capability,
    p_marketplace: params.marketplace || null,
    p_language: params.language || null,
    p_limit: params.limit,
  });

  if (error) {
    logger.warn({ type: "lexybrain_corpus_error", error: error.message }, "Failed to retrieve ai_corpus context");
    return [];
  }

  logger.info(
    {
      type: "lexybrain_rrf_search_response",
      capability: params.capability,
      marketplace: params.marketplace,
      results_count: data?.length ?? 0,
    },
    `RRF search returned ${data?.length ?? 0} corpus chunks`
  );

  return (data ?? []) as CorpusChunk[];
}

/* ----------------------------- Prompt Config ----------------------------- */

async function loadPromptConfig(promptKey: string): Promise<{
  systemInstructions: string;
  constraints: Record<string, unknown>;
  outputType: LexyBrainOutputType;
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { systemInstructions: "You are LexyBrain. Return JSON only.", constraints: {}, outputType: "market_brief" };
  }

  const { data: systemPrompt } = await supabase
    .from("ai_prompts")
    .select("content")
    .eq("key", "lexybrain_system")
    .eq("is_active", true)
    .maybeSingle();

  const { data: capabilityPrompt } = await supabase
    .from("ai_prompts")
    .select("content, config")
    .eq("key", promptKey)
    .eq("is_active", true)
    .maybeSingle();

  const systemInstructions = [systemPrompt?.content, capabilityPrompt?.content]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n\n");

  const constraints = (capabilityPrompt?.config as Record<string, unknown> | null)?.constraints;
  const outputType = (capabilityPrompt?.config as Record<string, unknown> | null)?.output_type;

  return {
    systemInstructions: systemInstructions || "You are LexyBrain. Return JSON only.",
    constraints: (constraints as Record<string, unknown>) ?? {},
    outputType: (outputType as LexyBrainOutputType) ?? "market_brief",
  };
}

/* ----------------------------- Context & References ----------------------------- */

function buildContext(
  config: CapabilityConfig,
  keywords: KeywordRecord[],
  marketplace: string | null,
  deterministic: {
    metrics: Record<string, unknown>;
    predictions: Record<string, unknown>[];
    risk: { rules: Record<string, unknown>[]; events: Record<string, unknown>[] };
    corpus: CorpusChunk[];
  }
): LexyBrainContext {
  const nicheTerms = keywords.map((k) => k.term);

  return {
    market: marketplace || keywords[0]?.market || "global",
    niche_terms: nicheTerms,
    keywords: keywords.map((k) => ({
      term: k.term,
      demand_index: k.demand_index,
      competition_score: k.competition_score,
      trend_momentum: k.trend_momentum,
      engagement_score: k.engagement_score,
      ai_opportunity_score: k.ai_opportunity_score,
    })),
    metadata: {
      capability: config,
      metrics: deterministic.metrics,
      predictions: deterministic.predictions,
      risk: deterministic.risk,
      corpus: deterministic.corpus,
    },
  };
}

function buildReferences(
  keywords: KeywordRecord[],
  deterministic: {
    metrics: Record<string, unknown>;
    predictions: Record<string, unknown>[];
    risk: { rules: Record<string, unknown>[]; events: Record<string, unknown>[] };
    corpus: CorpusChunk[];
  }
): Array<{ type: string; id: string; scope?: string | null; score?: number | null; extra?: Record<string, unknown> }> {
  const references: Array<{ type: string; id: string; scope?: string | null; score?: number | null; extra?: Record<string, unknown> }> = [];

  for (const keyword of keywords) references.push({ type: "keyword", id: keyword.id });

  const dailyMetrics = (deterministic.metrics.daily as Array<Record<string, unknown>> | undefined) ?? [];
  for (const entry of dailyMetrics) {
    const id = hashReference(["metric", toReferencePart((entry as any).keyword_id), toReferencePart((entry as any).collected_on)]);
    references.push({ type: "keyword_metrics_daily", id, extra: entry });
  }

  const weeklyMetrics = (deterministic.metrics.weekly as Array<Record<string, unknown>> | undefined) ?? [];
  for (const entry of weeklyMetrics) {
    const id = hashReference([
      "metric_weekly",
      toReferencePart((entry as any).keyword_id),
      toReferencePart((entry as any).week_start),
      toReferencePart((entry as any).source),
    ]);
    references.push({ type: "keyword_metrics_weekly", id, extra: entry });
  }

  for (const prediction of deterministic.predictions) {
    const id = hashReference([
      "prediction",
      toReferencePart((prediction as any).keyword_id),
      toReferencePart((prediction as any).horizon),
      toReferencePart((prediction as any).created_at),
    ]);
    references.push({ type: "keyword_predictions", id, extra: prediction });
  }

  for (const rule of deterministic.risk.rules) {
    if (typeof (rule as any).id === "string") {
      references.push({ type: "risk_rules", id: (rule as any).id, extra: rule });
    }
  }

  for (const event of deterministic.risk.events) {
    const id = hashReference(["risk_event", toReferencePart((event as any).id ?? (event as any).keyword_id), toReferencePart((event as any).occurred_at)]);
    references.push({ type: "risk_events", id, extra: event });
  }

  for (const chunk of deterministic.corpus) {
    references.push({
      type: `ai_corpus:${chunk.source_type}`,
      id: chunk.id,
      scope: chunk.owner_scope,
      score: chunk.combined_score,
      extra: { source_ref: chunk.source_ref, lexical_rank: chunk.lexical_rank, vector_rank: chunk.vector_rank },
    });
  }

  return references;
}

/* ----------------------------- Snapshots ----------------------------- */

async function persistSnapshots(params: {
  capability: LexyBrainCapability;
  scope: "user" | "team" | "global";
  userId: string;
  keywordIds: string[];
  insight: LexyBrainOutput;
  references: Array<{ type: string; id: string; extra?: Record<string, unknown> }>;
  metrics: Record<string, unknown>;
}): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase || params.keywordIds.length === 0) return [];

  const rows = params.keywordIds.map((keywordId) => ({
    keyword_id: keywordId,
    capability: params.capability,
    scope: params.scope,
    metrics_used: params.metrics,
    insight: params.insight,
    references: params.references,
    created_by: params.userId,
  }));

  const { data, error } = await supabase.from("keyword_insight_snapshots").insert(rows).select("id");
  if (error) {
    logger.warn({ type: "lexybrain_snapshot_error", error: error.message }, "Failed to persist insight snapshot");
    return [];
  }

  return (data ?? []).map((row) => (row as any).id as string);
}

/* ----------------------------- Orchestrator ----------------------------- */

export async function runLexyBrainOrchestration(
  request: LexyBrainOrchestrationRequest
): Promise<LexyBrainOrchestrationResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("LexyBrain orchestration unavailable: Supabase client missing");

  const config = CAPABILITY_CONFIG[request.capability] ?? CAPABILITY_CONFIG.keyword_insights;

  logger.info(
    {
      type: "lexybrain_orchestration_start",
      capability: request.capability,
      user_id: request.userId,
      keyword_ids: request.keywordIds?.length ?? 0,
      marketplace: request.marketplace,
    },
    "Starting LexyBrain orchestration"
  );

  const profile = await fetchUserProfile(request.userId);
  if (!profile) {
    logger.warn({ type: "lexybrain_missing_profile", user_id: request.userId }, "Missing user profile for LexyBrain access");
  }

  const keywordIds = Array.from(new Set(request.keywordIds ?? [])).filter((id) => typeof id === "string" && id.length > 0);
  const keywords = await fetchKeywords(keywordIds);
  if (keywordIds.length > 0 && keywords.length === 0) throw new Error("No reliable data: keywords not found in golden source");

  const metrics = await fetchKeywordMetrics(keywordIds);
  const predictions = await fetchPredictions(keywordIds, normalizeMarketplace(request.marketplace ?? null, null));
  const risk = await fetchRiskSignals(keywordIds, normalizeMarketplace(request.marketplace ?? null, null));

  const queryParts = [request.query ?? "", ...keywords.map((k) => k.term)];
  const queryText = queryParts.join(" ").trim();

  const firstKeywordMarket = keywords[0]?.market ?? null;
  const inferredFromKeywordExtras = (keywords[0]?.extras as any)?.source as string | undefined;

  const normalizedRequestMarket = normalizeMarketplace(request.marketplace ?? null, null);
  const normalizedKeywordMarket = normalizeMarketplace(firstKeywordMarket, inferredFromKeywordExtras);

  // Single point of truth for marketplace used in retrieval and context
  const resolvedMarketplace = normalizedRequestMarket ?? normalizedKeywordMarket;

  logger.info(
    {
      type: "lexybrain_corpus_search_params",
      capability: request.capability,
      user_id: request.userId,
      query_text: queryText,
      marketplace_raw_keyword: firstKeywordMarket,
      marketplace_norm_keyword: normalizedKeywordMarket,
      marketplace_norm_request: normalizedRequestMarket,
      marketplace_resolved: resolvedMarketplace,
      keywords_count: keywords.length,
    },
    "Preparing to search corpus with marketplace filter"
  );

  const corpus = await retrieveCorpusContext({
    queryText,
    capability: request.capability,
    marketplace: resolvedMarketplace,
    language: request.language ?? null,
    limit: config.maxContext,
  });

  logger.info(
    {
      type: "lexybrain_corpus_search_result",
      capability: request.capability,
      user_id: request.userId,
      corpus_count: corpus.length,
      marketplace_searched: resolvedMarketplace,
      query_text: queryText,
      sample_corpus_marketplaces: corpus.slice(0, 3).map((c) => c.marketplace),
    },
    `Corpus search returned ${corpus.length} results`
  );

  if (!corpus || corpus.length === 0) {
    const keywordTerm = keywords[0]?.term || queryText || "this keyword";
    logger.info(
      {
        type: "lexybrain_no_data",
        capability: request.capability,
        user_id: request.userId,
        keyword_ids: keywordIds.length,
        marketplace_searched: resolvedMarketplace,
        query_text: queryText,
        keyword_term: keywordTerm,
      },
      "No corpus data available - returning hard-stop no-data response"
    );

    let errorMessage = `We're still gathering data for "${keywordTerm}". Please check back in a few minutes.`;
    if (keywords.length === 0) {
      errorMessage = `This keyword isn't in our system yet. Try searching for "${keywordTerm}" first to add it to LexyHub.`;
    }
    throw new Error(errorMessage);
  }

  if (corpus.length < 5) {
    logger.warn(
      { type: "lexybrain_limited_context", capability: request.capability, user_id: request.userId, keyword_ids: keywordIds.length, corpus_count: corpus.length },
      "Limited corpus data available - proceeding with partial context"
    );
  }

  const promptConfig = await loadPromptConfig(config.promptKey);
  const context = buildContext(
    config,
    keywords,
    resolvedMarketplace,
    { metrics, predictions, risk, corpus }
  );

  const generation = await generateLexyBrainJson({
    type: promptConfig.outputType,
    context,
    userId: request.userId,
    promptConfig: { system_instructions: promptConfig.systemInstructions, constraints: promptConfig.constraints },
    maxRetries: 1,
  });

  const references = buildReferences(keywords, { metrics, predictions, risk, corpus });
  const snapshotIds = await persistSnapshots({
    capability: request.capability,
    scope: request.scope ?? config.defaultScope,
    userId: request.userId,
    keywordIds,
    insight: generation.output,
    references,
    metrics,
  });

  logger.info(
    {
      type: "lexybrain_orchestration_success",
      capability: request.capability,
      user_id: request.userId,
      keyword_ids: keywordIds.length,
      snapshot_ids: snapshotIds,
      latency_ms: generation.metadata.latencyMs,
    },
    "LexyBrain orchestration completed"
  );

  return {
    capability: request.capability,
    outputType: promptConfig.outputType,
    insight: generation.output,
    metrics: { profile, keyword_metrics: metrics, predictions, risk },
    references,
    llama: {
      modelVersion: generation.metadata.modelVersion,
      latencyMs: generation.metadata.latencyMs,
      promptTokens: generation.metadata.promptTokens,
      outputTokens: generation.metadata.outputTokens,
    },
    snapshot: snapshotIds.length > 0 ? { ids: snapshotIds } : undefined,
  };
}
