import type { DataForSEOKeywordItem, NormalizedKeyword } from "./types";

/**
 * Normalize a keyword term according to LexyHub standards
 * - Trim whitespace
 * - Collapse runs of spaces to one
 * - Lowercase
 * - Strip emojis and control characters
 * - NFKC Unicode normalization
 */
export function normalizeKeywordTerm(term: string): string {
  // Trim and lowercase
  let normalized = term.trim().toLowerCase();

  // NFKC Unicode normalization
  normalized = normalized.normalize("NFKC");

  // Remove emoji and control characters
  // This regex removes:
  // - Emoji ranges
  // - Control characters (U+0000 to U+001F, U+007F to U+009F)
  // - Zero-width characters
  normalized = normalized.replace(
    /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ""
  );

  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, " ");

  // Final trim
  return normalized.trim();
}

/**
 * Validate a normalized keyword term
 * Returns true if valid, false otherwise
 */
export function isValidKeywordTerm(term: string): boolean {
  // Length check: 2-120 characters
  if (term.length < 2 || term.length > 120) {
    return false;
  }

  // Reject if only digits and punctuation
  const hasLetters = /[a-zA-Z\u0080-\uFFFF]/.test(term);
  if (!hasLetters) {
    return false;
  }

  return true;
}

/**
 * Convert DataForSEO keyword item to normalized LexyHub format
 */
export function normalizeDataForSEOKeyword(
  item: DataForSEOKeywordItem,
  market: string,
  source: string,
  ingestBatchId: string
): NormalizedKeyword | null {
  const termOriginal = item.keyword;
  const termNorm = normalizeKeywordTerm(termOriginal);

  // Validate normalized term
  if (!isValidKeywordTerm(termNorm)) {
    return null;
  }

  // Build locale from language code
  const locale = item.language_code || "en";

  // Convert monthly searches to our format
  const monthlyTrend = item.monthly_searches
    ? item.monthly_searches.map((ms) => ({
        year: ms.year,
        month: ms.month,
        searches: ms.search_volume,
      }))
    : null;

  // Handle competition mapping: prefer numeric competition (0-1), fallback to mapped competition_level
  const competitionNumeric =
    typeof item.competition === "number" ? item.competition : null;

  const competitionLevel = item.competition_level; // "LOW" | "MEDIUM" | "HIGH"

  const competitionLevelNumeric =
    competitionLevel === "LOW"
      ? 0.2
      : competitionLevel === "MEDIUM"
        ? 0.5
        : competitionLevel === "HIGH"
          ? 0.8
          : null;

  // Use numeric competition if available, otherwise use mapped level, otherwise 0
  const competitionScore = competitionNumeric ?? competitionLevelNumeric ?? 0;

  return {
    termNorm,
    termOriginal,
    locale,
    market,
    source,
    ingestBatchId,
    searchVolume: item.search_volume || 0,
    cpc: item.cpc || 0,
    competition: competitionScore,
    monthlyTrend,
  };
}

/**
 * Batch normalize an array of DataForSEO items
 * Returns valid keywords only, with count of skipped
 */
export function normalizeDataForSEOBatch(
  items: DataForSEOKeywordItem[],
  market: string,
  source: string,
  ingestBatchId: string
): { valid: NormalizedKeyword[]; skipped: number } {
  const valid: NormalizedKeyword[] = [];
  let skipped = 0;

  for (const item of items) {
    const normalized = normalizeDataForSEOKeyword(item, market, source, ingestBatchId);
    if (normalized) {
      valid.push(normalized);
    } else {
      skipped++;
    }
  }

  return { valid, skipped };
}
