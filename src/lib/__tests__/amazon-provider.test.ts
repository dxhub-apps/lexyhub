import { promises as fs } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createAmazonProvider,
  type AmazonKeywordMetrics,
  type AmazonSuggestion,
} from "../providers/amazon";

async function loadFixture<T>(name: string): Promise<T> {
  const filePath = path.join(process.cwd(), "data", "amazon", name);
  const contents = await fs.readFile(filePath, "utf-8");
  return JSON.parse(contents) as T;
}

type Seed = { id: string; term: string; market: string; priority: number };

type SupabaseStub = ReturnType<typeof createSupabaseStub>;

function createSupabaseStub(seeds: Seed[]) {
  const keywordUpserts: Record<string, unknown>[] = [];
  const seedUpdates: Record<string, unknown>[] = [];

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "keyword_seeds") {
        const query: any = {};
        query.select = vi.fn().mockReturnValue(query);
        query.eq = vi.fn().mockReturnValue(query);
        query.order = vi.fn().mockReturnValue(query);
        query.limit = vi.fn().mockImplementation(async (limit: number) => ({
          data: seeds.slice(0, limit),
          error: null,
        }));
        query.update = vi.fn().mockImplementation((values: Record<string, unknown>) => {
          seedUpdates.push(values);
          return {
            in: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        });
        return query;
      }

      if (table === "keywords") {
        return {
          upsert: vi.fn().mockImplementation((payload: Record<string, unknown>[]) => {
            keywordUpserts.push(...payload);
            return {
              select: vi.fn().mockResolvedValue({
                data: payload.map((_, index) => ({ id: `kw-${index}` })),
                error: null,
              }),
            };
          }),
        };
      }

      throw new Error(`Unexpected table requested: ${table}`);
    }),
  } as unknown as SupabaseClient;

  return { supabase, keywordUpserts, seedUpdates };
}

function createSuggestFetcher(fixtures: Record<string, AmazonSuggestion[]>) {
  return async (seed: string) => ({
    suggestions: fixtures[seed] ?? [],
    tokens: (fixtures[seed] ?? []).length * 3,
  });
}

function createMetricsFetcher(fixtures: AmazonKeywordMetrics[]) {
  return async (keywords: string[]) => ({
    metrics: fixtures.filter((entry) => keywords.includes(String(entry.keyword))),
    tokens: keywords.length * 5,
  });
}

describe("Amazon provider", () => {
  let seeds: Seed[];
  let supabaseStub: SupabaseStub;

  beforeEach(() => {
    seeds = [
      { id: "seed-1", term: "handmade jewelry", market: "us", priority: 10 },
      { id: "seed-2", term: "boho decor", market: "us", priority: 8 },
    ];
    supabaseStub = createSupabaseStub(seeds);
  });

  it("ingests suggestions and metrics into Supabase", async () => {
    const suggestions = await loadFixture<Record<string, AmazonSuggestion[]>>("suggestions.json");
    const metrics = await loadFixture<AmazonKeywordMetrics[]>("metrics.json");

    const provider = createAmazonProvider({
      market: "us",
      tier: "growth",
      seedLimit: 5,
      maxKeywords: 6,
      dependencies: {
        suggestFetcher: createSuggestFetcher(suggestions),
        metricsFetcher: createMetricsFetcher(metrics),
        now: () => new Date("2024-07-15T12:00:00Z"),
        refreshIntervalMs: 1000 * 60 * 60,
      },
    });

    const result = await provider.refresh({ supabase: supabaseStub.supabase });

    expect(result.status).toBe("success");
    expect(result.keywordsProcessed).toBeGreaterThan(0);
    expect(result.keywordsUpserted).toBeGreaterThan(0);
    expect(result.tokensConsumed).toBeGreaterThan(0);
    expect(result.metadata?.market).toBe("us");

    expect(supabaseStub.keywordUpserts.length).toBe(result.keywordsProcessed);
    const first = supabaseStub.keywordUpserts[0];
    expect(first).toMatchObject({
      source: "amazon",
      tier: "growth",
      method: "amazon-suggest-paapi",
    });
    expect(first["extras"]).toMatchObject({ provider: "amazon" });
    expect(typeof first["ai_opportunity_score"]).toBe("number");

    expect(supabaseStub.seedUpdates).toHaveLength(1);
    expect(supabaseStub.seedUpdates[0]).toMatchObject({
      last_run_at: "2024-07-15T12:00:00.000Z",
    });
  });

  it("skips when no seeds available", async () => {
    const suggestions = await loadFixture<Record<string, AmazonSuggestion[]>>("suggestions.json");
    const metrics = await loadFixture<AmazonKeywordMetrics[]>("metrics.json");

    const provider = createAmazonProvider({
      market: "us",
      dependencies: {
        suggestFetcher: createSuggestFetcher(suggestions),
        metricsFetcher: createMetricsFetcher(metrics),
      },
    });

    const emptySupabase = createSupabaseStub([]);
    const result = await provider.refresh({ supabase: emptySupabase.supabase });
    expect(result.status).toBe("skipped");
    expect(result.error).toBe("No keyword seeds available");
  });
});
