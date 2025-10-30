import type { SupabaseClient } from "@supabase/supabase-js";

import { createProvenanceId, normalizeKeywordTerm } from "../keywords/utils";
import { getSupabaseServerClient } from "../supabase-server";

type NullableNumber = number | null | undefined;

export type KeywordRecord = {
  term: string;
  market: string;
  source: string;
  tier: "free" | "growth" | "scale" | string;
  demandIndex?: NullableNumber;
  competitionScore?: NullableNumber;
  engagementScore?: NullableNumber;
  aiOpportunityScore?: NullableNumber;
  trendMomentum?: NullableNumber;
  freshnessTs?: string;
  method?: string;
  sourceReason?: string;
  extras?: Record<string, unknown>;
};

export type ProviderRefreshOptions = {
  market?: string;
  limit?: number;
  seedLimit?: number;
  incremental?: boolean;
};

export type ProviderRefreshResult = {
  providerId: string;
  keywordsProcessed: number;
  keywordsUpserted: number;
  suggestionsEvaluated: number;
  tokensConsumed: number;
  startedAt: Date;
  finishedAt: Date;
  status: "success" | "skipped" | "failed";
  error?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderContext = {
  supabase?: SupabaseClient | null;
  logger?: ProviderLogger;
};

export type ProviderLogEntry = {
  providerId: string;
  event: "api-call" | "refresh" | "error";
  tokens?: number;
  details?: Record<string, unknown>;
  occurredAt?: Date;
};

export interface ProviderLogger {
  log(entry: ProviderLogEntry): void;
  error?(entry: ProviderLogEntry & { error: Error | string }): void;
}

class ConsoleProviderLogger implements ProviderLogger {
  log(entry: ProviderLogEntry): void {
    const payload = { ...entry, occurredAt: entry.occurredAt ?? new Date() };
    // eslint-disable-next-line no-console
    console.info("[provider]", payload);
  }

  error(entry: ProviderLogEntry & { error: Error | string }): void {
    const payload = { ...entry, occurredAt: entry.occurredAt ?? new Date() };
    // eslint-disable-next-line no-console
    console.error("[provider]", payload);
  }
}

export const defaultProviderLogger: ProviderLogger = new ConsoleProviderLogger();

export interface KeywordSourceProvider {
  readonly id: string;
  readonly label: string;
  readonly supportsIncremental: boolean;
  refresh(
    context?: ProviderContext,
    options?: ProviderRefreshOptions,
  ): Promise<ProviderRefreshResult>;
}

export function resolveProviderSupabase(context?: ProviderContext): SupabaseClient | null {
  if (context?.supabase) {
    return context.supabase;
  }
  return getSupabaseServerClient();
}

export function toKeywordPayload(record: KeywordRecord): Record<string, unknown> {
  const term = normalizeKeywordTerm(record.term);
  const market = normalizeKeywordTerm(record.market);
  const provenance = createProvenanceId(record.source, market, term);
  return {
    term,
    market,
    source: record.source,
    tier: record.tier,
    method: record.method ?? null,
    source_reason: record.sourceReason ?? null,
    demand_index: record.demandIndex ?? null,
    competition_score: record.competitionScore ?? null,
    engagement_score: record.engagementScore ?? null,
    ai_opportunity_score: record.aiOpportunityScore ?? null,
    trend_momentum: record.trendMomentum ?? null,
    freshness_ts: record.freshnessTs ?? new Date().toISOString(),
    extras: record.extras ?? {},
    provenance_id: provenance,
  };
}

export function normalizeProviderMarket(market?: string): string {
  return normalizeKeywordTerm(market ?? "us");
}
