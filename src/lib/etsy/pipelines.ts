import type { NormalizedEtsyListing } from "./types";

type KeywordExtractionResult = {
  keywords: string[];
};

type DifficultyScoreResult = {
  score: number;
  rationale: string;
};

type AiSuggestionResult = {
  suggestions: string[];
};

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function extractKeywords(listing: NormalizedEtsyListing): KeywordExtractionResult {
  const tokens = `${listing.title ?? ""} ${listing.description ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3);
  const keywords = dedupe([...listing.tags, ...tokens]).slice(0, 25);
  return { keywords };
}

function scoreDifficulty(listing: NormalizedEtsyListing): DifficultyScoreResult {
  const reviewSignal = (listing.reviews.count ?? 0) / 500;
  const ratingSignal = (listing.reviews.rating ?? 0) / 5;
  const priceSignal = (listing.price.amount ?? 0) / 100;
  const normalized = Math.min(1, reviewSignal * 0.6 + ratingSignal * 0.3 + priceSignal * 0.1);
  const rationale = `Computed from reviews=${listing.reviews.count ?? 0}, rating=${listing.reviews.rating ?? 0}, price=${
    listing.price.amount ?? 0
  }.`;
  return { score: Number(normalized.toFixed(2)), rationale };
}

function generateSuggestions(listing: NormalizedEtsyListing): AiSuggestionResult {
  const base = listing.title ?? "Your Etsy listing";
  const suggestions: string[] = [];
  if (!listing.description || listing.description.length < 120) {
    suggestions.push(`Expand the description for ${base} to include materials, dimensions, and a gifting hook.`);
  }
  if (listing.tags.length < 10) {
    suggestions.push(`Add more descriptive tags so ${base} reaches at least 10 unique keywords.`);
  }
  if (!listing.materials.length) {
    suggestions.push(`Call out the materials used in ${base} to reinforce quality and justify the price.`);
  }
  if (!suggestions.length) {
    suggestions.push(`Great job! Consider A/B testing price or imagery on ${base} to keep optimizing.`);
  }
  return { suggestions };
}

export const keywordExtractionService = {
  run: async (listing: NormalizedEtsyListing): Promise<KeywordExtractionResult> => extractKeywords(listing),
};

export const difficultyScoringService = {
  run: async (listing: NormalizedEtsyListing): Promise<DifficultyScoreResult> => scoreDifficulty(listing),
};

export const aiSuggestionService = {
  run: async (listing: NormalizedEtsyListing): Promise<AiSuggestionResult> => generateSuggestions(listing),
};

export type { KeywordExtractionResult, DifficultyScoreResult, AiSuggestionResult };
