import { NextResponse } from "next/server";

import { DEFAULT_EMBEDDING_MODEL, getOrCreateEmbedding } from "@/lib/ai/embeddings";
import { env } from "@/lib/env";
import { buildKeywordInsightCacheKey, getKeywordInsightFromCache, upsertKeywordInsightCache } from "@/lib/keywords/insights-cache";
import { createProvenanceId, normalizeKeywordTerm } from "@/lib/keywords/utils";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { PlanTier } from "@/lib/usage/quotas";

interface SearchRequestPayload {
  query?: string;
  market?: string;
  limit?: number;
  source?: string;
  sources?: string[];
  plan?: PlanTier | string;
}

type KeywordRow = {
  id?: string;
  term: string;
  market: string;
  source: string;
  tier?: string | number;
  method?: string | null;
  source_method?: string | null;
  source_reason?: string | null;
  extras?: Record<string, unknown> | null;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  provenance?: string | null;
  provenance_label?: string | null;
  source_label?: string | null;
  dataset?: string | null;
  sample_count?: number | null;
  serp_total_results?: number | null;
  serp_captured_at?: string | null;
};

type RankedKeyword = KeywordRow & {
  similarity: number;
  embeddingModel: string;
  provenance_id: string;
  compositeScore: number;
  rankingScore: number;
};

const PLAN_SOURCES: Record<PlanTier, string[]> = {
  free: ["synthetic"],
  growth: ["synthetic", "amazon"],
  scale: ["synthetic", "amazon"],
};

const PLAN_RANK: Record<string, number> = {
  free: 0,
  growth: 1,
  scale: 2,
};

const SOURCE_LABELS: Record<string, string> = {
  synthetic: "Synthetic AI",
  amazon: "Amazon Marketplace",
  etsy: "Etsy Marketplace",
  etsy_serp: "Etsy SERP Samples",
};

function normalizePlanTier(plan?: string | null): PlanTier {
  if (plan === "growth" || plan === "scale") {
    return plan;
  }
  return "free";
}

function normalizeMetric(value: number | null | undefined, fallback = 0.5): number {
  if (value == null) {
    return fallback;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  if (numeric < 0) {
    return fallback;
  }
  if (numeric > 1) {
    return Math.min(1, numeric / 100);
  }
  return Math.min(1, numeric);
}

function formatLabelPart(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapKeywordRow(row: Record<string, unknown>): KeywordRow {
  const market = typeof row.market === "string" && row.market.trim() ? row.market : "us";
  const source = typeof row.source === "string" && row.source.trim() ? row.source : "synthetic";
  const method = typeof row.method === "string" ? row.method : null;
  const sourceMethod =
    typeof row.source_method === "string"
      ? row.source_method
      : typeof row.method === "string"
        ? row.method
        : null;
  const mapped: KeywordRow = {
    id:
      typeof row.keyword_id === "string" && row.keyword_id
        ? row.keyword_id
        : typeof row.id === "string"
          ? row.id
          : undefined,
    term:
      typeof row.term === "string" && row.term.trim()
        ? row.term
        : typeof row.keyword_term === "string" && row.keyword_term.trim()
          ? row.keyword_term
          : "",
    market,
    source,
    tier: (row.tier as string | number | undefined) ?? undefined,
    method,
    source_method: sourceMethod,
    source_reason: typeof row.source_reason === "string" ? row.source_reason : null,
    extras: (row.extras as Record<string, unknown> | null | undefined) ?? null,
    trend_momentum: (row.trend_momentum as number | null | undefined) ?? null,
    ai_opportunity_score: (row.ai_opportunity_score as number | null | undefined) ?? null,
    demand_index: (row.demand_index as number | null | undefined) ?? null,
    competition_score: (row.competition_score as number | null | undefined) ?? null,
    engagement_score: (row.engagement_score as number | null | undefined) ?? null,
    freshness_ts: (row.freshness_ts as string | null | undefined) ?? null,
    provenance:
      typeof row.provenance === "string"
        ? row.provenance
        : typeof row.provenance_id === "string"
          ? row.provenance_id
          : null,
    provenance_label:
      typeof row.provenance_label === "string"
        ? row.provenance_label
        : typeof row.provenance_display === "string"
          ? row.provenance_display
          : null,
    source_label:
      typeof row.source_label === "string"
        ? row.source_label
        : typeof row.source_display_name === "string"
          ? row.source_display_name
          : null,
    dataset: typeof row.dataset === "string" ? row.dataset : null,
    sample_count:
      (row.sample_count as number | null | undefined) ??
      (row.serp_sample_count as number | null | undefined) ??
      (row.samples_count as number | null | undefined) ??
      null,
    serp_total_results:
      (row.serp_total_results as number | null | undefined) ??
      (row.total_results as number | null | undefined) ??
      (row.serp_results as number | null | undefined) ??
      null,
    serp_captured_at:
      (row.serp_captured_at as string | null | undefined) ??
      (row.last_serp_capture as string | null | undefined) ??
      (row.captured_at as string | null | undefined) ??
      null,
  };

  if (!mapped.provenance && mapped.source) {
    mapped.provenance = createProvenanceId(mapped.source, mapped.market, mapped.term);
  }

  if (!mapped.provenance_label) {
    const labelParts: string[] = [];
    const sourceLabel = SOURCE_LABELS[mapped.source] ?? formatLabelPart(mapped.source) ?? mapped.source;
    if (sourceLabel) {
      labelParts.push(sourceLabel);
    }
    const marketLabel = mapped.market ? mapped.market.toUpperCase() : null;
    if (marketLabel) {
      labelParts.push(marketLabel);
    }
    const methodLabel = formatLabelPart(mapped.source_method ?? mapped.method ?? null);
    if (methodLabel) {
      labelParts.push(methodLabel);
    }
    mapped.provenance_label = labelParts.join(" • ") || null;
  }

  if (!mapped.source_label) {
    mapped.source_label = SOURCE_LABELS[mapped.source] ?? formatLabelPart(mapped.source) ?? mapped.source;
  }

  return mapped;
}

function computeCompositeScore(keyword: KeywordRow): number {
  const demand = normalizeMetric(keyword.demand_index, 0.55);
  const competition = normalizeMetric(keyword.competition_score, 0.45);
  const trend = normalizeMetric(keyword.trend_momentum, 0.5);
  const demandComponent = 0.4 * demand;
  const competitionComponent = 0.3 * (1 - competition);
  const trendComponent = 0.3 * trend;
  return Math.min(1, demandComponent + competitionComponent + trendComponent);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (normA * normB);
}

async function queryKeywordInsights(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  market: string,
  sources: string[],
  tiers: Array<string | number>,
  limit: number,
): Promise<KeywordRow[]> {
  try {
    let queryBuilder = supabase.from("keyword_insights").select("*").eq("market", market);

    if (sources.length > 0) {
      queryBuilder = queryBuilder.in("source", sources);
    }

    if (tiers.length > 0) {
      queryBuilder = queryBuilder.in("tier", tiers);
    }

    const { data, error } = await queryBuilder.limit(Math.max(limit * 6, 150));

    if (error) {
      if (error.code !== "42P01") {
        console.warn("Keyword insights view unavailable", error);
      }
      return [];
    }

    return (data ?? []).map((row) => mapKeywordRow(row as Record<string, unknown>));
  } catch (error) {
    console.warn("Failed to query keyword insights view", error);
    return [];
  }
}

async function queryKeywordsTable(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  market: string,
  sources: string[],
  tiers: Array<string | number>,
  limit: number,
): Promise<KeywordRow[]> {
  const createQuery = (tierFilters: Array<string | number>) => {
    let queryBuilder = supabase
      .from("keywords")
      .select(
        "id, term, market, source, tier, method, source_reason, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, provenance_id",
      )
      .eq("market", market);

    if (sources.length > 0) {
      queryBuilder = queryBuilder.in("source", sources);
    }

    if (tierFilters.length > 0) {
      queryBuilder = queryBuilder.in("tier", tierFilters);
    }

    return queryBuilder;
  };

  const executeQuery = (tierFilters: Array<string | number>) =>
    createQuery(tierFilters).limit(Math.max(limit * 6, 150));

  let { data, error } = await executeQuery(tiers);

  if (error && error.code === "22P02") {
    const numericTierFilters = tiers
      .map((tier) => {
        if (typeof tier === "number") {
          return tier;
        }
        const rank = PLAN_RANK[tier as keyof typeof PLAN_RANK];
        return typeof rank === "number" ? rank : null;
      })
      .filter((value): value is number => value != null);

    if (numericTierFilters.length > 0) {
      ({ data, error } = await executeQuery(numericTierFilters));
    }
  }

  if (error) {
    console.error("Failed to fetch keywords from Supabase", error);
    return [];
  }

  return (data ?? []).map((row) => mapKeywordRow(row as Record<string, unknown>));
}

async function fetchKeywordsFromSupabase(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  market: string,
  sources: string[],
  tiers: Array<string | number>,
  limit: number,
): Promise<KeywordRow[]> {
  if (!supabase) {
    return [];
  }

  const fromInsights = await queryKeywordInsights(supabase, market, sources, tiers, limit);
  if (fromInsights.length > 0) {
    return fromInsights;
  }

  return queryKeywordsTable(supabase, market, sources, tiers, limit);
}

async function buildSummary(query: string, ranked: RankedKeyword[]): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    const preview = ranked.slice(0, 5).map((item) => item.term).join(", ");
    return preview
      ? `Top related synthetic keywords: ${preview}. (Generated via deterministic fallback)`
      : "We couldn't find any keywords for that search.";
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are LexyHub's commerce intelligence analyst. Summarize keyword opportunities clearly and concisely.",
          },
          {
            role: "user",
            content: `Query: ${query}. Keywords: ${ranked
              .slice(0, 10)
              .map((item) => `${item.term} (similarity ${(item.similarity * 100).toFixed(1)}%)`)
              .join(", " )}. Provide one actionable insight and compliance reminder.`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI summary request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const summary = payload.choices?.[0]?.message?.content;
    if (!summary) {
      throw new Error("OpenAI response missing summary content");
    }

    return summary.trim();
  } catch (error) {
    console.error("Failed to generate OpenAI summary", error);
    const preview = ranked.slice(0, 5).map((item) => item.term).join(", ");
    return preview
      ? `Top related synthetic keywords: ${preview}. (AI summary unavailable)`
      : "We couldn't find any keywords for that search.";
  }
}

async function rankKeywords(
  queryEmbedding: { embedding: number[]; model: string },
  keywords: KeywordRow[],
  supabaseClient: ReturnType<typeof getSupabaseServerClient>,
): Promise<RankedKeyword[]> {
  const ranked: RankedKeyword[] = [];

  for (const keyword of keywords) {
    const embedding = await getOrCreateEmbedding(keyword.term, {
      supabase: supabaseClient,
      model: DEFAULT_EMBEDDING_MODEL,
    });

    const similarity = cosineSimilarity(queryEmbedding.embedding, embedding.embedding);
    const compositeScore = computeCompositeScore(keyword);
    const rankingScore = similarity * 0.55 + compositeScore * 0.45;
    ranked.push({
      ...keyword,
      similarity,
      embeddingModel: embedding.model,
      provenance_id: createProvenanceId(keyword.source, keyword.market, keyword.term),
      compositeScore,
      rankingScore,
    });
  }

  return ranked.sort((a, b) => b.rankingScore - a.rankingScore);
}

async function loadSearchPayload(req: Request): Promise<SearchRequestPayload> {
  if (req.method === "GET") {
    const url = new URL(req.url);
    return {
      query: url.searchParams.get("q") ?? undefined,
      market: url.searchParams.get("market") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      source: url.searchParams.get("source") ?? undefined,
    };
  }

  const json = (await req.json().catch(() => ({}))) as SearchRequestPayload;
  return json;
}

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get("x-lexy-user-id");
  if (headerUserId && headerUserId.trim()) {
    return headerUserId.trim();
  }

  try {
    const url = new URL(req.url);
    const searchParamUserId = url.searchParams.get("userId");
    return searchParamUserId && searchParamUserId.trim() ? searchParamUserId.trim() : null;
  } catch (error) {
    console.warn("Failed to parse request URL while resolving user id", error);
  }

  return null;
}

async function recordKeywordSearchRequest({
  supabase,
  query,
  normalizedQuery,
  market,
  plan,
  sources,
  userId,
  reason = "no_results",
}: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  query: string;
  normalizedQuery: string;
  market: string;
  plan: PlanTier;
  sources: string[];
  userId: string | null;
  reason?: string;
}): Promise<void> {
  const payload = {
    user_id: userId,
    query,
    normalized_query: normalizedQuery,
    market,
    plan,
    sources,
    reason,
  };

  const { error } = await supabase.from("keyword_search_requests").insert(payload);

  if (error) {
    console.error("Failed to record keyword search request", { error, payload });
  }
}

async function handleSearch(req: Request): Promise<NextResponse> {
  const payload = await loadSearchPayload(req);
  const market = payload.market ? normalizeKeywordTerm(payload.market) : "us";
  const plan = normalizePlanTier(payload.plan ?? undefined);
  const requestedSources = Array.isArray(payload.sources)
    ? payload.sources
    : payload.source
      ? payload.source.split(",")
      : undefined;
  const allowedSources = PLAN_SOURCES[plan];
  const candidateSources = (requestedSources ?? allowedSources).map((item) => normalizeKeywordTerm(item));
  const filteredSources = candidateSources.filter((item) => allowedSources.includes(item));
  const resolvedSources = filteredSources.length > 0 ? filteredSources : allowedSources;
  const primarySource = resolvedSources[0] ?? allowedSources[0];
  const allowedTiers = Object.entries(PLAN_RANK)
    .filter(([, rank]) => rank <= PLAN_RANK[plan])
    .map(([tier]) => tier);
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 50));

  const queryRaw = payload.query;
  if (!queryRaw || !queryRaw.trim()) {
    return NextResponse.json({ error: "Query term is required." }, { status: 400 });
  }

  const trimmedQuery = queryRaw.trim();
  const query = normalizeKeywordTerm(trimmedQuery);
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const userId = resolveUserId(req);
  const keywords = await fetchKeywordsFromSupabase(supabase, market, resolvedSources, allowedTiers, limit);
  if (keywords.length === 0) {
    await recordKeywordSearchRequest({
      supabase,
      query: trimmedQuery,
      normalizedQuery: query,
      market,
      plan,
      sources: resolvedSources,
      userId,
    });

    return NextResponse.json({
      query,
      market,
      plan,
      source: primarySource,
      sources: resolvedSources,
      results: [],
      insights: {
        summary: "We couldn't find any keywords yet. Add some keywords to get search results.",
        generatedAt: new Date().toISOString(),
        model: "lexyhub-keywords",
      },
    });
  }

  const queryEmbedding = await getOrCreateEmbedding(query, { supabase });
  const ranked = await rankKeywords(queryEmbedding, keywords, supabase);
  const sliced = ranked.slice(0, limit);

  const cacheSources = [...resolvedSources].sort();

  const cacheKey = buildKeywordInsightCacheKey({
    query,
    market,
    plan,
    sources: cacheSources,
    results: sliced,
  });

  const cachedInsights = await getKeywordInsightFromCache(cacheKey, supabase);

  let insightsSummary: string;
  let insightsGeneratedAt: string;
  let insightsModel: string;

  if (cachedInsights) {
    insightsSummary = cachedInsights.summary;
    insightsGeneratedAt = cachedInsights.generatedAt;
    insightsModel = cachedInsights.model;
  } else {
    insightsSummary = await buildSummary(query, sliced);
    insightsGeneratedAt = new Date().toISOString();
    insightsModel = queryEmbedding.model;

    await upsertKeywordInsightCache(
      {
        cacheKey,
        summary: insightsSummary,
        generatedAt: insightsGeneratedAt,
        model: insightsModel,
        query,
        market,
        plan,
        sources: cacheSources,
      },
      supabase,
    );
  }

  return NextResponse.json({
    query,
    market,
    plan,
    source: primarySource,
    sources: resolvedSources,
    results: sliced,
    insights: {
      summary: insightsSummary,
      generatedAt: insightsGeneratedAt,
      model: insightsModel,
    },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  return handleSearch(req);
}

export async function GET(req: Request): Promise<NextResponse> {
  return handleSearch(req);
}
