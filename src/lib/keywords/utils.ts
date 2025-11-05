import { createHash } from "node:crypto";

/**
 * Normalizes a keyword term by trimming extra whitespace and
 * coercing to lowercase. The normalization is consistent across the
 * ingestion pipeline so hashes and caches line up regardless of source.
 */
export function normalizeKeywordTerm(term: string): string {
  if (!term) return "";
  return term
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Computes a deterministic hash for a keyword term combined with the
 * embedding model. This is used for caching embeddings so the same
 * string + model pair always resolves to the same record.
 */
export function hashKeywordTerm(term: string, model: string): string {
  const normalized = normalizeKeywordTerm(term);
  return createHash("sha256").update(`${model}::${normalized}`).digest("hex");
}

/**
 * Generates a provenance identifier that uniquely links the keyword to the
 * import method and market. Provenance identifiers let downstream systems
 * trace how a keyword was created.
 */
export function createProvenanceId(source: string, market: string, term: string): string {
  const normalized = normalizeKeywordTerm(term);
  return createHash("sha1").update(`${source}|${market}|${normalized}`).digest("hex");
}
