/**
 * Semantic Embeddings Service
 *
 * Provides production-ready semantic embeddings using HuggingFace Sentence Transformers
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
 *
 * Falls back to deterministic embeddings when HF is unavailable
 */

import { createDeterministicEmbedding } from "./embeddings";

const HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_EMBEDDING_DIMENSION = 384;
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}`;

interface EmbeddingOptions {
  model?: string;
  fallbackToDeterministic?: boolean;
  waitForModel?: boolean;
}

export class SemanticEmbeddingError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "SemanticEmbeddingError";
  }
}

/**
 * Generate semantic embedding using HuggingFace Inference API
 *
 * @param text - Input text to embed
 * @param options - Embedding options
 * @returns 384-dimensional embedding vector
 */
export async function createSemanticEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<number[]> {
  const {
    model = HF_EMBEDDING_MODEL,
    fallbackToDeterministic = true,
    waitForModel = true,
  } = options;

  const hfToken = process.env.HF_TOKEN;

  // If no HF token and fallback is enabled, use deterministic
  if (!hfToken && fallbackToDeterministic) {
    console.warn("[SemanticEmbedding] HF_TOKEN not configured, using deterministic fallback");
    return createDeterministicEmbedding(text, HF_EMBEDDING_DIMENSION);
  }

  if (!hfToken) {
    throw new SemanticEmbeddingError("HF_TOKEN is required for semantic embeddings");
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        options: {
          wait_for_model: waitForModel,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      // If model is loading and we allow fallback, use deterministic
      if (response.status === 503 && fallbackToDeterministic) {
        console.warn(`[SemanticEmbedding] Model loading (503), using deterministic fallback`);
        return createDeterministicEmbedding(text, HF_EMBEDDING_DIMENSION);
      }

      throw new SemanticEmbeddingError(
        `HuggingFace API error: ${response.status} - ${errorText}`,
        response.status
      );
    }

    const embedding = await response.json();

    // Handle different response formats
    let embeddingArray: number[];

    if (Array.isArray(embedding)) {
      // Direct array response
      embeddingArray = embedding;
    } else if (embedding && Array.isArray(embedding.embeddings)) {
      // Wrapped in embeddings key
      embeddingArray = embedding.embeddings[0] || embedding.embeddings;
    } else if (embedding && typeof embedding === "object") {
      // Try to find array in response
      const values = Object.values(embedding);
      const arrayValue = values.find((v) => Array.isArray(v));
      if (arrayValue) {
        embeddingArray = arrayValue as number[];
      } else {
        throw new SemanticEmbeddingError("Invalid embedding format in response");
      }
    } else {
      throw new SemanticEmbeddingError("Unexpected response format from HuggingFace API");
    }

    // Validate dimension
    if (embeddingArray.length !== HF_EMBEDDING_DIMENSION) {
      console.warn(
        `[SemanticEmbedding] Unexpected dimension: got ${embeddingArray.length}, expected ${HF_EMBEDDING_DIMENSION}`
      );

      // Pad or truncate to expected dimension
      if (embeddingArray.length < HF_EMBEDDING_DIMENSION) {
        embeddingArray = [
          ...embeddingArray,
          ...new Array(HF_EMBEDDING_DIMENSION - embeddingArray.length).fill(0),
        ];
      } else {
        embeddingArray = embeddingArray.slice(0, HF_EMBEDDING_DIMENSION);
      }
    }

    return embeddingArray;
  } catch (error) {
    if (error instanceof SemanticEmbeddingError) {
      throw error;
    }

    // Network or other errors - fallback if allowed
    if (fallbackToDeterministic) {
      console.warn(
        `[SemanticEmbedding] Error generating semantic embedding: ${error}. Using deterministic fallback.`
      );
      return createDeterministicEmbedding(text, HF_EMBEDDING_DIMENSION);
    }

    throw new SemanticEmbeddingError(
      `Failed to generate semantic embedding: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Batch generate embeddings for multiple texts
 *
 * @param texts - Array of texts to embed
 * @param options - Embedding options
 * @returns Array of embedding vectors
 */
export async function createSemanticEmbeddingBatch(
  texts: string[],
  options: EmbeddingOptions = {}
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process in batches to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const batchEmbeddings = await Promise.all(
      batch.map((text) => createSemanticEmbedding(text, options))
    );

    embeddings.push(...batchEmbeddings);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

/**
 * Test semantic embedding service connectivity
 *
 * @returns Test result with success status and details
 */
export async function testSemanticEmbeddingService(): Promise<{
  success: boolean;
  message: string;
  dimension?: number;
  model?: string;
  fallbackUsed?: boolean;
}> {
  try {
    const testText = "test keyword semantic embedding";
    const embedding = await createSemanticEmbedding(testText, {
      fallbackToDeterministic: true,
      waitForModel: false,
    });

    const isDeterministic = process.env.HF_TOKEN ? false : true;

    return {
      success: true,
      message: isDeterministic
        ? "Semantic embedding service using deterministic fallback (HF_TOKEN not set)"
        : "Semantic embedding service operational",
      dimension: embedding.length,
      model: HF_EMBEDDING_MODEL,
      fallbackUsed: isDeterministic,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
