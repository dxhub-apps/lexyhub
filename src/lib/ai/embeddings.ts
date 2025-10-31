import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "../env";
import { createProvenanceId, hashKeywordTerm, normalizeKeywordTerm } from "../keywords/utils";
import { getSupabaseServerClient } from "../supabase-server";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";

const MODEL_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-large": 3072,
  "text-embedding-3-small": 1536,
  "text-embedding-ada-002": 1536,
};

const DEFAULT_EMBEDDING_DIMENSION = MODEL_DIMENSIONS[DEFAULT_EMBEDDING_MODEL];

const DETERMINISTIC_SUFFIX = "-deterministic-fallback";

function resolveEmbeddingDimension(model: string, fallback?: number): number {
  const normalizedModel = model.endsWith(DETERMINISTIC_SUFFIX)
    ? model.slice(0, -DETERMINISTIC_SUFFIX.length)
    : model;

  return MODEL_DIMENSIONS[normalizedModel] ?? fallback ?? DEFAULT_EMBEDDING_DIMENSION;
}

function normalizeEmbeddingLength(values: number[], dimension: number): number[] {
  if (values.length === dimension) {
    return values;
  }

  if (values.length > dimension) {
    return values.slice(0, dimension);
  }

  return [...values, ...new Array(dimension - values.length).fill(0)];
}

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

  const payload = data as EmbeddingRow;
  const dimension = resolveEmbeddingDimension(payload.model, payload.embedding?.length);

  return {
    ...payload,
    embedding: normalizeEmbeddingLength(payload.embedding ?? [], dimension),
  };
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
  let targetDimension = resolveEmbeddingDimension(model);

  if (client) {
    const cached = await readCachedEmbedding(client, termHash);
    if (cached) {
      const dimension = resolveEmbeddingDimension(cached.model, cached.embedding.length);
      return {
        ...cached,
        embedding: normalizeEmbeddingLength(cached.embedding, dimension),
        created: false,
      };
    }
  }

  let embedding: number[];
  let generatedModel = model;

  try {
    const rawEmbedding = await fetchEmbeddingFromOpenAI(normalized, model);
    targetDimension = resolveEmbeddingDimension(model, rawEmbedding.length);

    if (rawEmbedding.length !== targetDimension) {
      console.warn(
        `Embedding dimension mismatch for model ${model}: expected ${targetDimension}, received ${rawEmbedding.length}. Normalizing for storage.`,
      );
    }
    embedding = normalizeEmbeddingLength(rawEmbedding, targetDimension);
  } catch (error) {
    if (!fallbackToDeterministic) {
      throw error;
    }

    targetDimension = resolveEmbeddingDimension(model, targetDimension);
    embedding = createDeterministicEmbedding(normalized, targetDimension);
    generatedModel = `${model}${DETERMINISTIC_SUFFIX}`;
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
