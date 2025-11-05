import { NextResponse } from "next/server";

import { DEFAULT_EMBEDDING_MODEL, getOrCreateEmbedding } from "@/lib/ai/embeddings";
import { env } from "@/lib/env";
import {
  buildKeywordInsightCacheKey,
  getKeywordInsightFromCache,
  upsertKeywordInsightCache,
} from "@/lib/keywords/insights-cache";
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
  extras?: Record<string, unknown> | null;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  demand_index?: number | null;
  competition_score?: number | null;
  engagement_score?: number | null;
  freshness_ts?: string | null;
  base_demand_index?: number | null;
  adjusted_demand_index?: number | null;
  deseasoned_trend_momentum?: number | null;
  seasonal_label?: string | null;
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

function normalizePlanTier(plan?: string | null): PlanTier {
  if (plan === "growth" || plan === "scale") return plan;
  return "free";
}

function normalizeMetric(value: number | null | undefined, fallback = 0.5): number {
  if (value == null) return fallback;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;
  if (numeric < 0) return fallback;
  if (numeric > 1) return Math.min(1, numeric / 100);
  return Math.min(1, numeric);
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
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

async function fetchKeywordsFromSupabase(
  market: string,
  sources: string[],
  tiers: Array<string | number>,
  limit: number,
  likeTerm?: string
): Promise<KeywordRow[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return [];

  const createQuery = (tierFilters: Array<string | number>) => {
    let queryBuilder = supabase
      .from("keywords")
      .select(
        "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label",
      )
      .eq("market", market);

    if (sources.length > 0) {
      queryBuilder = queryBuilder.in("source", sources);
    }
    if (tierFilters.length > 0) {
      queryBuilder = queryBuilder.in("tier", tierFilters);
    }
    if (likeTerm && likeTerm.length >= 3) {
      queryBuilder = queryBuilder.ilike("term", `%${likeTerm}%`);
    }

    return queryBuilder;
  };

  const executeQuery = (tierFilters: Array<string | number>) =>
    createQuery(tierFilters).limit(Math.max(limit * 6, 150));

  let { data, error } = await executeQuery(tiers);

  if (error && error.code === "22P02") {
    const numericTierFilters = tiers
      .map((tier) => {
        if (typeof tier === "number") return tier;
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

  return data ?? [];
}

// exact-match helper ignoring plan/source filters
async function findExactKeyword(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  market: string,
  trimmedQuery: string
): Promise<KeywordRow | null> {
  // 1) exact case-insensitive equality via RPC (uses lower(term)=lower(p_term))
  try {
    const { data: exactEq } = await supabase
      .rpc("lexy_lower_eq_keyword", { p_market: market, p_term: trimmedQuery })
      .maybeSingle();
    if (exactEq) return exactEq as KeywordRow;
  } catch (e) {
    // fall through to plain queries if RPC not yet deployed
  }

  // 2) exact ILIKE (same text, different case)
  const { data: exactIlike } = await supabase
    .from("keywords")
    .select(
      "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label",
    )
    .eq("market", market)
    .ilike("term", trimmedQuery)
    .limit(1)
    .maybeSingle();
  if (exactIlike) return exactIlike as KeywordRow;

  // 3) partial contains to improve recall
  const { data: partial } = await supabase
    .from("keywords")
    .select(
      "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label",
    )
    .eq("market", market)
    .ilike("term", `%${trimmedQuery}%`)
    .order("term", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (partial as KeywordRow) ?? null;
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
              .join(", ")}. Provide one actionable insight and compliance reminder.`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI summary request failed: ${response.status}`);

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const summary = payload.choices?.[0]?.message?.content;
    if (!summary) throw new Error("OpenAI response missing summary content");

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
  originalQuery: string,
): Promise<RankedKeyword[]> {
  const ranked: RankedKeyword[] = [];
  const qLower = originalQuery.toLowerCase().trim();

  for (const keyword of keywords) {
    const embedding = await getOrCreateEmbedding(keyword.term, {
      supabase: supabaseClient,
      model: DEFAULT_EMBEDDING_MODEL,
    });

    const sim = cosineSimilarity(queryEmbedding.embedding, embedding.embedding);
    const composite = computeCompositeScore(keyword);
    const isExact = keyword.term.toLowerCase().trim() === qLower;

    const rankingScore = isExact ? Number.MAX_SAFE_INTEGER : (sim * 0.55 + composite * 0.45);

    ranked.push({
      ...keyword,
      similarity: isExact ? 1 : sim,
      embeddingModel: embedding.model,
      provenance_id: createProvenanceId(keyword.source, keyword.market, keyword.term),
      compositeScore: composite,
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
  if (headerUserId && headerUserId.trim()) return headerUserId.trim();

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
  if (error) console.error("Failed to record keyword search request", { error, payload });
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
  if (!supabase) return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });

  const userId = resolveUserId(req);

  // Log every search to telemetry (Task 1)
  await recordKeywordSearchRequest({
    supabase,
    query: trimmedQuery,
    normalizedQuery: query,
    market,
    plan,
    sources: resolvedSources,
    userId,
    reason: 'queried',
  });

  // Backfill normalized keyword to golden source (Task 1)
  try {
    await supabase.rpc('lexy_upsert_keyword', {
      p_term: trimmedQuery,
      p_market: market,
      p_source: 'ai',
      p_tier: plan,
      p_method: 'search_touch',
      p_extras: {},
      p_freshness: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to upsert search keyword to golden source', error);
  }

  // exact match ignoring plan/source restrictions
  let exactMatchKeyword: KeywordRow | null = null;
  try {
    exactMatchKeyword = await findExactKeyword(supabase, market, trimmedQuery);
  } catch (error) {
    console.error("Failed to fetch exact match keyword", error);
  }

  // fetch candidate pool under plan filters and a light text prefilter
  const keywords = await fetchKeywordsFromSupabase(
    market,
    resolvedSources,
    allowedTiers,
    limit,
    trimmedQuery
  );

  // ensure exact match is present even if its source/tier is outside plan gating
  const needsInject =
    !!exactMatchKeyword && !keywords.some((k) => k.id && k.id === exactMatchKeyword!.id);

  const allKeywords = needsInject
    ? [exactMatchKeyword!, ...keywords]
    : exactMatchKeyword
    ? [exactMatchKeyword, ...keywords.filter((k) => k.id !== exactMatchKeyword.id)]
    : keywords;

  if (allKeywords.length === 0) {
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

  // rank; exact matches are hard-pinned inside ranker by setting MAX_SAFE_INTEGER
  const ranked = await rankKeywords(queryEmbedding, allKeywords, supabase, trimmedQuery);
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
