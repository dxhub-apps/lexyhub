import type { SupabaseClient } from "@supabase/supabase-js";

import { getOrCreateEmbedding } from "@/lib/ai/embeddings";
import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export type MarketTwinScenario = {
  listingId: string;
  userId: string;
  scenarioTitle: string;
  scenarioTags: string[];
  scenarioPriceCents: number;
  scenarioDescription?: string;
  goals?: string[];
};

export type MarketTwinResult = {
  semanticGap: number;
  trendCorrelationDelta: number;
  predictedVisibility: number;
  confidence: number;
  explanation: string;
  embeddingModel: string;
  metadata: Record<string, unknown>;
};

export type ListingDetails = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  status: string;
  tags: string[];
  stats: { views: number; favorites: number } | null;
  marketplace_account_id: string;
};

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (normA * normB);
}

async function fetchListingDetails(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingDetails | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, description, price_cents, currency, status, marketplace_account_id")
    .eq("id", listingId)
    .maybeSingle();

  if (error) {
    console.warn("Failed to load listing", error);
    return null;
  }

  if (!data) {
    return null;
  }

  const [tagsResponse, statsResponse] = await Promise.all([
    supabase.from("listing_tags").select("tag").eq("listing_id", listingId),
    supabase
      .from("listing_stats")
      .select("views, favorites")
      .eq("listing_id", listingId)
      .order("recorded_on", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (tagsResponse.error) {
    console.warn("Failed to load listing tags", tagsResponse.error);
  }

  if (statsResponse.error) {
    console.warn("Failed to load listing stats", statsResponse.error);
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    price_cents: data.price_cents,
    currency: data.currency,
    status: data.status,
    marketplace_account_id: data.marketplace_account_id,
    tags: (tagsResponse.data ?? []).map((row) => row.tag),
    stats: statsResponse.data
      ? {
          views: Number(statsResponse.data.views ?? 0),
          favorites: Number(statsResponse.data.favorites ?? 0),
        }
      : null,
  } satisfies ListingDetails;
}

async function fetchKeywordTrends(supabase: SupabaseClient, tags: string[]): Promise<number> {
  if (tags.length === 0) {
    return 0.4;
  }
  const { data, error } = await supabase
    .from("keywords")
    .select("term, trend_momentum")
    .in("term", tags)
    .limit(50);

  if (error) {
    console.warn("Failed to load keyword trends", error);
    return 0.4;
  }

  if (!data || data.length === 0) {
    return 0.4;
  }

  const average =
    data.reduce((sum, row) => sum + Number(row.trend_momentum ?? 0.4), 0) / Math.max(data.length, 1);
  return Number.isFinite(average) ? average : 0.4;
}

function computeVisibility(
  baseline: ListingDetails,
  scenario: MarketTwinScenario,
  semanticGap: number,
  trendDelta: number,
): number {
  const baseViews = baseline.stats?.views ?? 50;
  const priceFactor = baseline.price_cents && scenario.scenarioPriceCents
    ? Math.min(1.5, baseline.price_cents / Math.max(scenario.scenarioPriceCents, 1))
    : 1;
  const statusFactor = baseline.status === "active" ? 1 : 0.7;
  const tagFactor = 1 + Math.max(0, trendDelta) * 0.6;
  const semanticFactor = 1 - semanticGap * 0.5;
  const projected = baseViews * priceFactor * statusFactor * tagFactor * semanticFactor;
  return Math.max(0, Math.min(projected / 500, 1));
}

async function buildExplanation(
  scenario: MarketTwinScenario,
  result: { semanticGap: number; trendDelta: number; visibility: number },
  baseline: ListingDetails,
): Promise<string> {
  const summary = `Semantic gap ${(result.semanticGap * 100).toFixed(1)}%, trend delta ${(result.trendDelta * 100).toFixed(
    1,
  )}%, predicted visibility ${(result.visibility * 100).toFixed(1)}%.`;

  if (!env.OPENAI_API_KEY) {
    return `${summary} Consider aligning tags ${scenario.scenarioTags.slice(0, 5).join(", ")} with top performing baseline tags.`;
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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are LexyHub's Market Twin analyst. Explain simulation results with positive guidance and note risk factors.",
          },
          {
            role: "user",
            content: `Baseline listing: ${baseline.title}. Scenario title: ${scenario.scenarioTitle}. Baseline tags: ${
              baseline.tags.join(", ")
            }. Scenario tags: ${scenario.scenarioTags.join(", ")}. ${summary}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI completion failed: ${response.status}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content ?? summary;
  } catch (error) {
    console.warn("Failed to build Market Twin explanation", error);
    return summary;
  }
}

export async function runMarketTwinSimulation(
  scenario: MarketTwinScenario,
  supabaseClient?: SupabaseClient | null,
): Promise<{ baseline: ListingDetails | null; result: MarketTwinResult | null }> {
  const supabase = supabaseClient ?? getSupabaseServerClient();
  if (!supabase) {
    return { baseline: null, result: null };
  }

  const baseline = await fetchListingDetails(supabase, scenario.listingId);
  if (!baseline) {
    return { baseline: null, result: null };
  }

  const baselineText = `${baseline.title}\n${baseline.tags.join(", ")}`;
  const scenarioText = `${scenario.scenarioTitle}\n${scenario.scenarioTags.join(", ")}`;

  const [baselineEmbedding, scenarioEmbedding, baselineTrend, scenarioTrend] = await Promise.all([
    getOrCreateEmbedding(baselineText, { supabase }),
    getOrCreateEmbedding(scenarioText, { supabase }),
    fetchKeywordTrends(supabase, baseline.tags),
    fetchKeywordTrends(supabase, scenario.scenarioTags),
  ]);

  const semanticGap = 1 - cosineSimilarity(baselineEmbedding.embedding, scenarioEmbedding.embedding);
  const trendDelta = scenarioTrend - baselineTrend;
  const visibility = computeVisibility(baseline, scenario, semanticGap, trendDelta);
  const explanation = await buildExplanation(
    scenario,
    { semanticGap, trendDelta, visibility },
    baseline,
  );

  const result: MarketTwinResult = {
    semanticGap,
    trendCorrelationDelta: trendDelta,
    predictedVisibility: visibility,
    confidence: Math.max(0.2, 1 - semanticGap * 0.7),
    explanation,
    embeddingModel: baselineEmbedding.model,
    metadata: {
      baselineTrend,
      scenarioTrend,
      baselineViews: baseline.stats?.views ?? null,
      baselineFavorites: baseline.stats?.favorites ?? null,
    },
  };

  return { baseline, result };
}
