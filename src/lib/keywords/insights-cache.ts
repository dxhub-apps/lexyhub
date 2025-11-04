import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TABLE = "keyword_insights_cache";

export interface KeywordInsightCacheKeyInput {
  query: string;
  market: string;
  plan: string;
  sources: string[];
  results: Array<{
    term: string;
    similarity: number;
    rankingScore: number;
    provenance_id?: string;
  }>;
}

export interface KeywordInsightCacheRecord {
  cacheKey: string;
  summary: string;
  model: string;
  generatedAt: string;
  query: string;
  market: string;
  plan: string;
  sources: string[];
}

function serializeResults(input: KeywordInsightCacheKeyInput["results"]): string {
  return input
    .slice(0, 10)
    .map((item) => {
      const similarity = Number.isFinite(item.similarity) ? item.similarity : 0;
      const rankingScore = Number.isFinite(item.rankingScore) ? item.rankingScore : 0;
      const provenance = item.provenance_id ?? "";
      return `${item.term}|${provenance}|${similarity.toFixed(4)}|${rankingScore.toFixed(4)}`;
    })
    .join("||");
}

export function buildKeywordInsightCacheKey(input: KeywordInsightCacheKeyInput): string {
  const normalizedSources = [...input.sources].sort();
  const payload = JSON.stringify({
    query: input.query,
    market: input.market,
    plan: input.plan,
    sources: normalizedSources,
    signature: serializeResults(input.results),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function getKeywordInsightFromCache(
  cacheKey: string,
  supabase: SupabaseClient,
): Promise<KeywordInsightCacheRecord | null> {
  try {
    const { data, error } = await supabase
      .from(CACHE_TABLE)
      .select("summary, model, generated_at, query, market, plan, sources")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error) {
      // PGRST205: Table not found - cache table doesn't exist yet, skip caching silently
      if (error.code === "PGRST205") {
        return null;
      }
      console.warn("Failed to read keyword insights cache", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      cacheKey,
      summary: data.summary ?? "",
      model: data.model ?? "unknown", // fallback guards against null columns
      generatedAt: data.generated_at ?? new Date().toISOString(),
      query: data.query ?? "",
      market: data.market ?? "",
      plan: data.plan ?? "free",
      sources: Array.isArray(data.sources) ? data.sources : [],
    } satisfies KeywordInsightCacheRecord;
  } catch (error) {
    console.warn("Error while retrieving keyword insights cache", error);
    return null;
  }
}

export async function upsertKeywordInsightCache(
  record: KeywordInsightCacheRecord,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const { error } = await supabase.from(CACHE_TABLE).upsert(
      {
        cache_key: record.cacheKey,
        summary: record.summary,
        model: record.model,
        generated_at: record.generatedAt,
        query: record.query,
        market: record.market,
        plan: record.plan,
        sources: record.sources,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );

    if (error) {
      // PGRST205: Table not found - cache table doesn't exist yet, skip caching silently
      if (error.code !== "PGRST205") {
        console.warn("Failed to persist keyword insights cache", error);
      }
    }
  } catch (error) {
    console.warn("Error while persisting keyword insights cache", error);
  }
}
