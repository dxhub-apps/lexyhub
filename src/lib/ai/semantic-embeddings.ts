// src/lib/ai/semantic-embeddings.ts

import { HfInference } from "@huggingface/inference";
import { env } from "../env";

/**
 * Only Hugging Face Inference API is used.
 * Embeddings are generated via the official @huggingface/inference SDK.
 * Model is fixed to a sentence-transformers encoder suitable for semantic search.
 */

const HF_TOKEN = env.HF_TOKEN;

const SEMANTIC_EMBEDDING_MODEL =
  process.env.SEMANTIC_EMBEDDING_MODEL ||
  "sentence-transformers/all-MiniLM-L6-v2";

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
 * Call Hugging Face Inference API using the official SDK.
 *
 * Uses the current supported Router infrastructure via @huggingface/inference.
 * This avoids the deprecated https://api-inference.huggingface.co endpoint
 * and correctly uses feature extraction for embeddings.
 */
async function fetchHuggingFaceEmbedding(text: string): Promise<number[]> {
  ensureEnv();

  const hf = new HfInference(HF_TOKEN);

  try {
    const result = await hf.featureExtraction({
      model: SEMANTIC_EMBEDDING_MODEL,
      inputs: text,
    });

    // Handle response shape
    // Result can be:
    // 1) number[] - single embedding
    // 2) number[][] - batch of embeddings (take first)
    // 3) nested structures

    let embedding: number[];

    if (Array.isArray(result)) {
      // Check if it's a batch (array of arrays)
      if (result.length > 0 && Array.isArray(result[0])) {
        // Take the first embedding from the batch
        embedding = result[0] as number[];
      } else {
        // It's a single embedding
        embedding = result as number[];
      }
    } else {
      throw new SemanticEmbeddingError(
        "Unexpected HuggingFace embeddings response format."
      );
    }

    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new SemanticEmbeddingError(
        "HuggingFace returned invalid embedding vector."
      );
    }

    // Ensure all values are numbers
    return embedding.map((x) => Number(x));
  } catch (err: any) {
    // Handle HF SDK errors
    const statusCode = err?.status || err?.statusCode;
    const message = err?.message || String(err);

    throw new SemanticEmbeddingError(
      `HuggingFace Inference error: ${message}`,
      statusCode,
      err
    );
  }
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
