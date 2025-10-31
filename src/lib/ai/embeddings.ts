import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import { createProvenanceId, hashKeywordTerm, normalizeKeywordTerm } from "../keywords/utils";
import { getSupabaseServerClient } from "../supabase-server";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";
const DEFAULT_EMBEDDING_DIMENSION = 3072;

type EmbeddingRow = {
  term_hash: string;
  term: string;
  embedding: number[];
  model: string;
};

export type EmbeddingResult = EmbeddingRow & { created: boolean };

export class EmbeddingError extends Error {}

export class MissingEmbeddingCredentialsError extends EmbeddingError {
  constructor() {
    super("OpenAI API key is not configured for embedding generation.");
  }
}

function getSupabaseClientOverride(
  supabase?: SupabaseClient | null,
): SupabaseClient | null {
  if (supabase) {
    return supabase;
  }

  return getSupabaseServerClient();
}

export function createDeterministicEmbedding(
  term: string,
  dimension: number = DEFAULT_EMBEDDING_DIMENSION,
): number[] {
  const normalized = normalizeKeywordTerm(term);
  let seed = createHash("sha256").update(normalized).digest();
  const values: number[] = [];

  for (let i = 0; i < dimension; i += 1) {
    const byte = seed[i % seed.length];
    const value = Number((byte / 255).toFixed(6));
    values.push(value);

    if (i % seed.length === seed.length - 1) {
      seed = createHash("sha256").update(seed).digest();
    }
  }

  return values;
}

async function fetchEmbeddingFromOpenAI(term: string, model: string): Promise<number[]> {
  if (!env.OPENAI_API_KEY) {
    throw new MissingEmbeddingCredentialsError();
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, input: term }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new EmbeddingError(
      `OpenAI embedding request failed with status ${response.status}: ${payload}`,
    );
  }

  const json = (await response.json()) as { data?: Array<{ embedding: number[] }> };
  const embedding = json.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new EmbeddingError("OpenAI response did not include an embedding vector.");
  }

  return embedding.map((value) => Number(value));
}

async function readCachedEmbedding(
  supabase: SupabaseClient,
  termHash: string,
): Promise<EmbeddingRow | null> {
  const query = supabase
    .from("embeddings")
    .select("term_hash, term, embedding, model")
    .eq("term_hash", termHash)
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new EmbeddingError(error.message);
  }

  if (!data) {
    return null;
  }

  return data as EmbeddingRow;
}

async function persistEmbedding(
  supabase: SupabaseClient,
  payload: EmbeddingRow,
): Promise<void> {
  const { error } = await supabase.from("embeddings").upsert(payload, {
    onConflict: "term_hash",
  });

  if (error) {
    throw new EmbeddingError(error.message);
  }
}

export async function getOrCreateEmbedding(
  term: string,
  {
    model = DEFAULT_EMBEDDING_MODEL,
    supabase,
    fallbackToDeterministic = true,
  }: {
    model?: string;
    supabase?: SupabaseClient | null;
    fallbackToDeterministic?: boolean;
  } = {},
): Promise<EmbeddingResult> {
  const client = getSupabaseClientOverride(supabase);
  const normalized = normalizeKeywordTerm(term);
  const termHash = hashKeywordTerm(term, model);

  if (client) {
    const cached = await readCachedEmbedding(client, termHash);
    if (cached) {
      return { ...cached, created: false };
    }
  }

  let embedding: number[];
  let generatedModel = model;

  try {
    embedding = await fetchEmbeddingFromOpenAI(normalized, model);
  } catch (error) {
    if (!fallbackToDeterministic) {
      throw error;
    }

    embedding = createDeterministicEmbedding(normalized);
    generatedModel = `${model}-deterministic-fallback`;
  }

  const payload: EmbeddingRow = {
    term_hash: termHash,
    term: normalized,
    embedding,
    model: generatedModel,
  };

  if (client) {
    await persistEmbedding(client, payload);
  }

  return { ...payload, created: true };
}

export async function ensureKeywordEmbeddings(
  terms: Array<{ term: string; market?: string; source?: string }>,
  options?: { model?: string; supabase?: SupabaseClient | null },
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (const record of terms) {
    const embedding = await getOrCreateEmbedding(record.term, options);
    results.push(embedding);
  }

  return results;
}

export function createEmbeddingProvenance(
  term: string,
  market: string,
  source: string,
): string {
  return createProvenanceId(source, market, term);
}
