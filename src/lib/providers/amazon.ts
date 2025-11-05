import {
  type KeywordSourceProvider,
  type ProviderContext,
  type ProviderRefreshOptions,
  type ProviderRefreshResult,
  normalizeProviderMarket,
  resolveProviderSupabase,
  toKeywordPayload,
} from "./base";
import { normalizeKeywordTerm } from "../keywords/utils";

export type AmazonSuggestion = {
  keyword: string;
  score: number;
  type?: string;
};

export type AmazonKeywordMetrics = {
  keyword: string;
  searchVolume?: number;
  conversionRate?: number;
  competition?: number;
  growthRate?: number;
  asinSamples?: Array<{
    asin: string;
    title: string;
    price: number;
  }>;
};

export type SuggestFetcherResult = {
  suggestions: AmazonSuggestion[];
  tokens?: number;
};

export type MetricsFetcherResult = {
  metrics: AmazonKeywordMetrics[];
  tokens?: number;
};

export type AmazonSuggestFetcher = (seed: string, market: string) => Promise<SuggestFetcherResult>;

export type AmazonMetricsFetcher = (keywords: string[], market: string) => Promise<MetricsFetcherResult>;

export type AmazonProviderDependencies = {
  suggestFetcher: AmazonSuggestFetcher;
  metricsFetcher: AmazonMetricsFetcher;
  now?: () => Date;
  refreshIntervalMs?: number;
};

export type AmazonProviderConfig = {
  market: string;
  tier?: string;
  seedLimit?: number;
  maxKeywords?: number;
  sourceId?: string;
  dependencies: AmazonProviderDependencies;
};

function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function normalizeScale(value: number | undefined, divisor: number, fallback = 0.5): number {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (divisor <= 0) {
    return clamp(value);
  }
  if (Math.abs(value) > 1) {
    return clamp(value / divisor);
  }
  return clamp(value);
}

function normalizeRate(value: number | undefined, fallback = 0.15): number {
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value > 1) {
    return clamp(value / 100);
  }
  return clamp(value);
}

function computeOpportunityScore(
  demand: number,
  competition: number,
  trend: number,
): number {
  const demandComponent = 0.4 * demand;
  const competitionComponent = 0.3 * (1 - competition);
  const trendComponent = 0.3 * trend;
  return clamp(demandComponent + competitionComponent + trendComponent);
}

function dedupeSuggestions(
  suggestions: Array<AmazonSuggestion & { seedId: string; seedTerm: string }>,
): Array<{
  term: string;
  score: number;
  seedId: string;
  seedTerm: string;
  type?: string;
}> {
  const map = new Map<string, { term: string; score: number; seedId: string; seedTerm: string; type?: string }>();
  for (const suggestion of suggestions) {
    const term = normalizeKeywordTerm(suggestion.keyword);
    if (!term) {
      continue;
    }
    const existing = map.get(term);
    if (!existing || suggestion.score > existing.score) {
      map.set(term, {
        term,
        score: suggestion.score,
        seedId: suggestion.seedId,
        seedTerm: suggestion.seedTerm,
        type: suggestion.type,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function buildExtras(
  meta: {
    seedId: string;
    seedTerm: string;
    type?: string;
  },
  metrics?: AmazonKeywordMetrics,
): Record<string, unknown> {
  return {
    provider: "amazon",
    seedId: meta.seedId,
    seedTerm: meta.seedTerm,
    type: meta.type ?? null,
    amazon: {
      metrics: metrics ?? null,
    },
  };
}

export class AmazonKeywordProvider implements KeywordSourceProvider {
  readonly id: string;

  readonly label = "Amazon Marketplace";

  readonly supportsIncremental = true;

  private readonly tier: string;

  private readonly seedLimit: number;

  private readonly maxKeywords: number;

  private readonly dependencies: AmazonProviderDependencies;

  private readonly market: string;

  constructor(config: AmazonProviderConfig) {
    this.id = config.sourceId ?? "amazon";
    this.market = normalizeProviderMarket(config.market);
    this.tier = config.tier ?? "growth";
    this.seedLimit = Math.max(1, config.seedLimit ?? 10);
    this.maxKeywords = Math.max(1, config.maxKeywords ?? 120);
    this.dependencies = config.dependencies;
  }

  async refresh(
    context?: ProviderContext,
    options?: ProviderRefreshOptions,
  ): Promise<ProviderRefreshResult> {
    const supabase = resolveProviderSupabase(context);
    const startedAt = this.dependencies.now?.() ?? new Date();

    if (!supabase) {
      return {
        providerId: this.id,
        keywordsProcessed: 0,
        keywordsUpserted: 0,
        suggestionsEvaluated: 0,
        tokensConsumed: 0,
        startedAt,
        finishedAt: startedAt,
        status: "skipped",
        error: "Supabase client unavailable",
      };
    }

    const market = normalizeProviderMarket(options?.market ?? this.market);
    const limit = Math.max(1, Math.min(options?.limit ?? this.maxKeywords, this.maxKeywords));
    const seedLimit = Math.max(1, Math.min(options?.seedLimit ?? this.seedLimit, this.seedLimit));

    const { data: seeds, error: seedError } = await supabase
      .from("keyword_seeds")
      .select("id, term, market, priority")
      .eq("market", market)
      .eq("status", "ready")
      .order("priority", { ascending: false })
      .limit(seedLimit);

    if (seedError) {
      throw new Error(`Amazon provider failed to load seeds: ${seedError.message}`);
    }

    if (!seeds || seeds.length === 0) {
      const finishedAt = this.dependencies.now?.() ?? new Date();
      return {
        providerId: this.id,
        keywordsProcessed: 0,
        keywordsUpserted: 0,
        suggestionsEvaluated: 0,
        tokensConsumed: 0,
        startedAt,
        finishedAt,
        status: "skipped",
        error: "No keyword seeds available",
        metadata: { market },
      };
    }

    const aggregated: Array<AmazonSuggestion & { seedId: string; seedTerm: string }> = [];
    let suggestionTokens = 0;

    for (const seed of seeds) {
      const response = await this.dependencies.suggestFetcher(seed.term, market);
      suggestionTokens += response.tokens ?? 0;
      context?.logger?.log({
        providerId: this.id,
        event: "api-call",
        tokens: response.tokens ?? 0,
        details: { endpoint: "suggest", seed: seed.term, count: response.suggestions.length },
      });
      for (const suggestion of response.suggestions) {
        aggregated.push({ ...suggestion, seedId: seed.id, seedTerm: seed.term });
      }
    }

    const deduped = dedupeSuggestions(aggregated).slice(0, limit);
    const keywordsProcessed = deduped.length;

    if (deduped.length === 0) {
      const finishedAt = this.dependencies.now?.() ?? new Date();
      return {
        providerId: this.id,
        keywordsProcessed: 0,
        keywordsUpserted: 0,
        suggestionsEvaluated: aggregated.length,
        tokensConsumed: suggestionTokens,
        startedAt,
        finishedAt,
        status: "skipped",
        error: "No suggestions returned from Amazon", 
        metadata: { market },
      };
    }

    const metricsResult = await this.dependencies.metricsFetcher(
      deduped.map((item) => item.term),
      market,
    );
    const metricsTokens = metricsResult.tokens ?? 0;

    context?.logger?.log({
      providerId: this.id,
      event: "api-call",
      tokens: metricsTokens,
      details: { endpoint: "paapi", keywords: deduped.length },
    });

    const metricsMap = new Map<string, AmazonKeywordMetrics>();
    for (const metric of metricsResult.metrics) {
      const key = normalizeKeywordTerm(metric.keyword);
      metricsMap.set(key, metric);
    }

    const now = this.dependencies.now?.() ?? new Date();

    // Use lexy_upsert_keyword RPC for each keyword (Task 3)
    let keywordsUpserted = 0;
    for (const item of deduped) {
      const metrics = metricsMap.get(item.term);
      const demand = normalizeScale(metrics?.searchVolume, 1000, 0.55);
      const competition = normalizeScale(metrics?.competition ?? metrics?.conversionRate, 100, 0.45);
      const trend = normalizeScale(metrics?.growthRate, 100, 0.5);
      const engagement = normalizeRate(metrics?.conversionRate, 0.12);
      const opportunity = computeOpportunityScore(demand, competition, trend);

      try {
        await supabase.rpc('lexy_upsert_keyword', {
          p_term: item.term,
          p_market: market,
          p_source: this.id,
          p_tier: this.tier,
          p_method: "amazon-suggest-paapi",
          p_extras: buildExtras(item, metrics),
          p_demand: demand,
          p_competition: competition,
          p_engagement: engagement,
          p_ai: opportunity,
          p_freshness: now.toISOString(),
        });
        keywordsUpserted++;
      } catch (error) {
        console.error(`Amazon provider failed to upsert keyword "${item.term}":`, error);
      }
    }

    const seedIds = seeds.map((seed) => seed.id);
    const refreshInterval = this.dependencies.refreshIntervalMs ?? 1000 * 60 * 60 * 6;
    const nextRun = new Date(now.getTime() + refreshInterval).toISOString();

    await supabase
      .from("keyword_seeds")
      .update({
        last_run_at: now.toISOString(),
        next_run_at: nextRun,
      })
      .in("id", seedIds);

    const finishedAt = this.dependencies.now?.() ?? new Date();

    return {
      providerId: this.id,
      keywordsProcessed,
      keywordsUpserted,
      suggestionsEvaluated: aggregated.length,
      tokensConsumed: suggestionTokens + metricsTokens,
      startedAt,
      finishedAt,
      status: "success",
      metadata: {
        market,
        seedsQueried: seeds.length,
        metricsReturned: metricsResult.metrics.length,
      },
    };
  }
}

export function createAmazonProvider(config: AmazonProviderConfig): AmazonKeywordProvider {
  return new AmazonKeywordProvider(config);
}
