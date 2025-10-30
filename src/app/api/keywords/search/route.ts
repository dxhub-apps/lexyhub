import { NextResponse } from "next/server";

import {
  DEFAULT_EMBEDDING_MODEL,
  createDeterministicEmbedding,
  getOrCreateEmbedding,
} from "@/lib/ai/embeddings";
import { env } from "@/lib/env";
import { loadSyntheticDataset } from "@/lib/synthetic/import";
import { createProvenanceId, normalizeKeywordTerm } from "@/lib/keywords/utils";
import { getSupabaseServerClient } from "@/lib/supabase-server";

interface SearchRequestPayload {
  query?: string;
  market?: string;
  limit?: number;
  source?: string;
}

type KeywordRow = {
  id?: string;
  term: string;
  market: string;
  source: string;
  tier?: string;
  method?: string | null;
  extras?: Record<string, unknown> | null;
  trend_momentum?: number | null;
  ai_opportunity_score?: number | null;
  freshness_ts?: string | null;
};

type RankedKeyword = KeywordRow & {
  similarity: number;
  embeddingModel: string;
  provenance_id: string;
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

async function fetchKeywordsFromSupabase(
  market: string,
  source: string,
  limit: number,
): Promise<KeywordRow[]> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("keywords")
    .select(
      "id, term, market, source, tier, method, extras, trend_momentum, ai_opportunity_score, freshness_ts",
    )
    .eq("market", market)
    .eq("source", source)
    .limit(Math.max(limit * 4, 100));

  if (error) {
    console.error("Failed to fetch keywords from Supabase", error);
    return [];
  }

  return data ?? [];
}

async function fallbackKeywords(market: string): Promise<KeywordRow[]> {
  try {
    const dataset = await loadSyntheticDataset("data/synthetic/keywords.json");
    return dataset.map((record) => {
      const term = normalizeKeywordTerm(typeof record === "string" ? record : record.term);
      return {
        term,
        market,
        source: "synthetic",
        tier: "free",
        method: "synthetic-ai",
        extras: typeof record === "string" ? null : { category: record.category ?? null },
      } satisfies KeywordRow;
    });
  } catch (error) {
    console.warn("Fallback keyword dataset unavailable", error);
    return [];
  }
}

async function buildSummary(query: string, ranked: RankedKeyword[]): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    const preview = ranked.slice(0, 5).map((item) => item.term).join(", ");
    return preview
      ? `Top related synthetic keywords: ${preview}. (Generated via deterministic fallback)`
      : "No matching keywords were found for the supplied query.";
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
      : "No matching keywords were found for the supplied query.";
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
    ranked.push({
      ...keyword,
      similarity,
      embeddingModel: embedding.model,
      provenance_id: createProvenanceId(keyword.source, keyword.market, keyword.term),
    });
  }

  return ranked.sort((a, b) => b.similarity - a.similarity);
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

async function buildDeterministicResults(
  query: string,
  market: string,
  limit: number,
): Promise<{ results: RankedKeyword[]; summary: string }> {
  const dataset = await fallbackKeywords(market);
  const queryEmbedding = createDeterministicEmbedding(query);
  const ranked = dataset.map((record) => {
    const embedding = createDeterministicEmbedding(record.term);
    return {
      ...record,
      similarity: cosineSimilarity(queryEmbedding, embedding),
      embeddingModel: `${DEFAULT_EMBEDDING_MODEL}-deterministic-fallback`,
      provenance_id: createProvenanceId(record.source, record.market, record.term),
    } satisfies RankedKeyword;
  });

  ranked.sort((a, b) => b.similarity - a.similarity);
  const sliced = ranked.slice(0, limit);
  const summary = await buildSummary(query, sliced);
  return { results: sliced, summary };
}

async function handleSearch(req: Request): Promise<NextResponse> {
  const payload = await loadSearchPayload(req);
  const market = payload.market ? normalizeKeywordTerm(payload.market) : "us";
  const source = payload.source ?? "synthetic";
  const limit = Math.max(1, Math.min(payload.limit ?? 20, 50));

  const queryRaw = payload.query;
  if (!queryRaw || !queryRaw.trim()) {
    return NextResponse.json({ error: "Query term is required." }, { status: 400 });
  }

  const query = normalizeKeywordTerm(queryRaw);
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const deterministic = await buildDeterministicResults(query, market, limit);
    return NextResponse.json({
      query,
      market,
      source,
      results: deterministic.results,
      insights: {
        summary: deterministic.summary,
        generatedAt: new Date().toISOString(),
        model: "deterministic-fallback",
      },
    });
  }

  const keywords = await fetchKeywordsFromSupabase(market, source, limit);
  if (keywords.length === 0) {
    const deterministic = await buildDeterministicResults(query, market, limit);
    return NextResponse.json({
      query,
      market,
      source,
      results: deterministic.results,
      insights: {
        summary: deterministic.summary,
        generatedAt: new Date().toISOString(),
        model: "deterministic-fallback",
      },
    });
  }

  const queryEmbedding = await getOrCreateEmbedding(query, { supabase });
  const ranked = await rankKeywords(queryEmbedding, keywords, supabase);
  const sliced = ranked.slice(0, limit);
  const summary = await buildSummary(query, sliced);

  return NextResponse.json({
    query,
    market,
    source,
    results: sliced,
    insights: {
      summary,
      generatedAt: new Date().toISOString(),
      model: queryEmbedding.model,
    },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  return handleSearch(req);
}

export async function GET(req: Request): Promise<NextResponse> {
  return handleSearch(req);
}
