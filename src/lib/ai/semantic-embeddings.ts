// src/lib/ai/semantic-embeddings.ts

import { env } from "../env";

/**
 * Only Hugging Face Inference API is used.
 * Embeddings are generated via the /embeddings/{model} endpoint.
 * Model is fixed to a sentence-transformers encoder suitable for semantic search.
 */

const HUGGINGFACE_BASE_URL =
  process.env.HUGGINGFACE_API_URL?.replace(/\/+$/, "") ||
  "https://api-inference.huggingface.co";

const SEMANTIC_EMBEDDING_MODEL =
  process.env.SEMANTIC_EMBEDDING_MODEL ||
  "sentence-transformers/all-MiniLM-L6-v2";

const HF_TOKEN = env.HF_TOKEN;

/**
 * Errors
 */

export class SemanticEmbeddingError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = "SemanticEmbeddingError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class MissingEmbeddingCredentialsError extends SemanticEmbeddingError {
  constructor() {
    super(
      "Missing HF_TOKEN for Hugging Face Inference API embeddings.",
      401
    );
    this.name = "MissingEmbeddingCredentialsError";
  }
}

/**
 * Internal helpers
 */

function ensureEnv() {
  if (!HF_TOKEN) {
    throw new MissingEmbeddingCredentialsError();
  }
  if (!SEMANTIC_EMBEDDING_MODEL) {
    throw new SemanticEmbeddingError(
      "SEMANTIC_EMBEDDING_MODEL is not configured."
    );
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 3,
    baseDelayMs = 500,
  }: {
    retries?: number;
    baseDelayMs?: number;
  } = {}
): Promise<T> {
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries) {
        throw err;
      }
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
}

/**
 * Call Hugging Face /embeddings endpoint.
 *
 * This avoids the sentence-similarity pipeline signature issue:
 * we always send { "inputs": "<text>" } to an embeddings-capable model.
 */
async function fetchHuggingFaceEmbedding(text: string): Promise<number[]> {
  ensureEnv();

  const url = `${HUGGINGFACE_BASE_URL}/embeddings/${encodeURIComponent(
    SEMANTIC_EMBEDDING_MODEL
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  const raw = await res.text();

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // ignore parse errors
    }
    throw new SemanticEmbeddingError(
      `HuggingFace API error: ${res.status} - ${raw}`,
      res.status,
      parsed
    );
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new SemanticEmbeddingError(
      "Failed to parse HuggingFace embeddings response."
    );
  }

  // Supported shapes:
  // 1) [number, ...]
  // 2) [[number, ...]]
  // 3) { embeddings: [number, ...] } or { embeddings: [[number,...]] }
  if (Array.isArray(data)) {
    if (data.length > 0 && Array.isArray(data[0])) {
      // [[dim]]
      return data[0] as number[];
    }
    // [dim]
    return data as number[];
  }

  if (data && Array.isArray(data.embeddings)) {
    const e = data.embeddings;
    if (e.length > 0 && Array.isArray(e[0])) {
      return e[0] as number[];
    }
    return e as number[];
  }

  throw new SemanticEmbeddingError(
    "Unexpected HuggingFace embeddings response format."
  );
}

/**
 * Public API
 *
 * Used by ingestion jobs and any RAG indexing.
 */

export async function getSemanticEmbedding(
  text: string
): Promise<number[]> {
  const cleaned = text.trim();
  if (!cleaned) {
    throw new SemanticEmbeddingError(
      "Cannot create embedding for empty text."
    );
  }

  // Simple length guard to avoid absurd payloads
  const maxChars = 8000;
  const input =
    cleaned.length > maxChars
      ? cleaned.slice(0, maxChars)
      : cleaned;

  return withRetry(() => fetchHuggingFaceEmbedding(input));
}

/**
 * Backwards-compatible helper name.
 * Jobs can call createSemanticEmbedding(...) and get a single vector.
 */
export function createSemanticEmbedding(
  text: string
): Promise<number[]> {
  return getSemanticEmbedding(text);
}
