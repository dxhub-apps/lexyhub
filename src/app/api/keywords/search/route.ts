// src/app/api/keywords/search/route.ts
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
import { enforceQuota, QuotaExceededError } from "@/lib/billing/enforce";

interface SearchRequestPayload {
  query?: string;
  market?: string;
  limit?: number;
  source?: string;
  sources?: string[];
  plan?: PlanTier | string;
  final?: boolean | string;
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
  // Extracted from extras field
  search_volume?: number | null;
  cpc?: number | null;
  monthly_trend?: Array<{ year: number; month: number; searches: number }> | null;
  dataforseo_competition?: number | null;
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

const PLAN_RANK = {
  free: 0,
  growth: 1,
  scale: 2,
} as const satisfies Record<PlanTier, number>;

type PlanRank = (typeof PLAN_RANK)[PlanTier];

function resolvePlanRank(plan: PlanTier): PlanRank {
  const rank = PLAN_RANK[plan];
  if (typeof rank === "number" && Number.isInteger(rank)) {
    return Math.max(0, Math.min(2, rank)) as PlanRank;
  }
  return PLAN_RANK.free;
}

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

function extractDataForSEOMetrics(extras: Record<string, unknown> | null): {
  search_volume: number | null;
  cpc: number | null;
  monthly_trend: Array<{ year: number; month: number; searches: number }> | null;
  dataforseo_competition: number | null;
} {
  if (!extras) {
    return { search_volume: null, cpc: null, monthly_trend: null, dataforseo_competition: null };
  }

  const search_volume = typeof extras.search_volume === "number" ? extras.search_volume : null;
  const cpc = typeof extras.cpc === "number" ? extras.cpc : null;

  let monthly_trend: Array<{ year: number; month: number; searches: number }> | null = null;
  if (Array.isArray(extras.monthly_trend)) {
    monthly_trend = extras.monthly_trend
      .filter((item: any) =>
        item &&
        typeof item === "object" &&
        typeof item.year === "number" &&
        typeof item.month === "number" &&
        typeof item.searches === "number"
      )
      .map((item: any) => ({
        year: item.year,
        month: item.month,
        searches: item.searches,
      }));
    if (monthly_trend.length === 0) monthly_trend = null;
  }

  let dataforseo_competition: number | null = null;
  if (extras.dataforseo && typeof extras.dataforseo === "object") {
    const dfObj = extras.dataforseo as Record<string, unknown>;
    dataforseo_competition = typeof dfObj.competition === "number" ? dfObj.competition : null;
  }

  return { search_volume, cpc, monthly_trend, dataforseo_competition };
}

function coerceKeyword(row: any): KeywordRow {
  const extracted = extractDataForSEOMetrics(row?.extras ?? null);

  return {
    id: row?.id ?? undefined,
    term: String(row.term),
    market: String(row.market),
    source: String(row.source),
    tier: row?.tier ?? undefined,
    method: row?.method ?? null,
    extras: row?.extras ?? null,
    trend_momentum: row?.trend_momentum ?? null,
    ai_opportunity_score: row?.ai_opportunity_score ?? null,
    demand_index: row?.demand_index ?? null,
    competition_score: row?.competition_score ?? null,
    engagement_score: row?.engagement_score ?? null,
    freshness_ts: row?.freshness_ts ?? null,
    base_demand_index: row?.base_demand_index ?? null,
    adjusted_demand_index: row?.adjusted_demand_index ?? null,
    deseasoned_trend_momentum: row?.deseasoned_trend_momentum ?? null,
    seasonal_label: row?.seasonal_label ?? null,
    search_volume: extracted.search_volume,
    cpc: extracted.cpc,
    monthly_trend: extracted.monthly_trend,
    dataforseo_competition: extracted.dataforseo_competition,
  };
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

  const selectColumns =
    "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label";

  const createQuery = (tierFilters: Array<string | number>) => {
    let queryBuilder = supabase
      .from("keywords")
      .select(selectColumns)
      .eq("market", market)
      .not("term", "is", null)
      .neq("term", "");

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

  const rows: any[] = Array.isArray(data) ? data : [];
  return rows
    .filter((k) => typeof k?.term === "string" && k.term.trim().length > 0)
    .map((k) => coerceKeyword(k));
}

// exact-match helper ignoring plan/source filters
async function findExactKeyword(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>,
  market: string,
  trimmedQuery: string
): Promise<KeywordRow | null> {
  const selectColumns =
    "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts, demand_index, competition_score, engagement_score, base_demand_index, adjusted_demand_index, deseasoned_trend_momentum, seasonal_label";

  try {
    const { data: exactEq } = await supabase
      .rpc("lexy_lower_eq_keyword", { p_market: market, p_term: trimmedQuery })
      .maybeSingle();
    if (exactEq && typeof (exactEq as any).term === "string") return coerceKeyword(exactEq);
  } catch {
    // ignore
  }

  const { data: exactIlike } = await supabase
    .from("keywords")
    .select(selectColumns)
    .eq("market", market)
    .not("term", "is", null)
    .neq("term", "")
    .ilike("term", trimmedQuery)
    .limit(1)
    .maybeSingle();
  if (exactIlike && typeof (exactIlike as any).term === "string") return coerceKeyword(exactIlike);

  const { data: partial } = await supabase
    .from("keywords")
    .select(selectColumns)
    .eq("market", market)
    .not("term", "is", null)
    .neq("term", "")
    .ilike("term", `%${trimmedQuery}%`)
    .order("term", { ascending: true })
    .limit(1)
    .maybeSingle();

  return partial && typeof (partial as any).term === "string" ? coerceKeyword(partial) : null;
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
    const term = typeof keyword.term === "string" ? keyword.term.trim() : "";
    if (!term) continue;

    const embedding = await getOrCreateEmbedding(term, {
      supabase: supabaseClient,
      model: DEFAULT_EMBEDDING_MODEL,
    });

    const sim = cosineSimilarity(queryEmbedding.embedding, embedding.embedding);
    const composite = computeCompositeScore(keyword);
    const isExact = term.toLowerCase() === qLower;

    const rankingScore = isExact ? Number.MAX_SAFE_INTEGER : sim * 0.55 + composite * 0.45;

    ranked.push({
      ...keyword,
      term,
      similarity: isExact ? 1 : sim,
      embeddingModel: embedding.model,
      provenance_id: createProvenanceId(keyword.source, keyword.market, term),
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
      final: url.searchParams.get("final") ?? undefined,
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
  const candidateSources = (requestedSources ?? allowedSources)
    .filter((item) => item && item.trim())
    .map((item) => normalizeKeywordTerm(item));
  const filteredSources = candidateSources.filter((item) => item && allowedSources.includes(item));
  const resolvedSources = filteredSources.length > 0 ? filteredSources : allowedSources;
  const primarySource = resolvedSources[0] ?? allowedSources[0];

  const planRank = resolvePlanRank(plan);
  const allowedTiers = Object.entries(PLAN_RANK)
    .filter(([, rank]) => rank <= planRank)
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

  // Enforce keyword search quota (KS) for authenticated users
  if (userId) {
    try {
      await enforceQuota(userId, "ks", 1);
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: "Quota exceeded",
            code: "quota_exceeded",
            quota_key: "ks",
            used: error.used,
            limit: error.limit,
            message: `You've reached your monthly keyword search limit (${error.limit} searches). Upgrade your plan for more searches.`,
          },
          { status: 402 }
        );
      }
      // Re-throw other errors
      throw error;
    }
  }

  // Check if keyword already exists in the keywords table
  let exactMatchKeyword: KeywordRow | null = null;
  try {
    exactMatchKeyword = await findExactKeyword(supabase, market, trimmedQuery);
  } catch (error) {
    console.error("Failed to fetch exact match keyword", error);
  }

  // Record all final searches (when user presses Enter, clicks Search button, or clicks suggestion)
  // This helps track user search behavior and analytics
  const keywordExists = exactMatchKeyword !== null;
  const isFinalSearch = payload.final === true || payload.final === "true";

  if (isFinalSearch) {
    // Record the search request with appropriate reason
    const reason = keywordExists ? "search" : "new_keyword";
    await recordKeywordSearchRequest({
      supabase,
      query: trimmedQuery,
      normalizedQuery: query,
      market,
      plan,
      sources: resolvedSources,
      userId,
      reason,
    });
  }

  // If the keyword doesn't exist yet, insert it into the keywords table for future searches
  if (!keywordExists && isFinalSearch) {
    try {
      const tier = resolvePlanRank(plan);

      const result = await supabase.rpc("lexy_upsert_keyword", {
        p_term: trimmedQuery,
        p_market: market,
        p_source: "ai",
        p_tier: tier,
        p_method: "search_touch",
        p_extras: {},
        p_freshness: new Date().toISOString(),
      });

      if (result.error) {
        console.error("Error from lexy_upsert_keyword:", result.error);
      } else {
        console.log("Successfully upserted keyword:", trimmedQuery, "with id:", result.data);

        // Re-fetch the keyword after inserting it
        try {
          exactMatchKeyword = await findExactKeyword(supabase, market, trimmedQuery);
        } catch (error) {
          console.error("Failed to re-fetch exact match keyword after insert", error);
        }
      }
    } catch (error) {
      console.error("Failed to upsert search keyword to golden source", error);
    }
  }

  const keywords = await fetchKeywordsFromSupabase(
    market,
    resolvedSources,
    allowedTiers,
    limit,
    trimmedQuery,
  );

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
