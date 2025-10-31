import { tokenizeForDensity } from "./util";

type NumericSummary = {
  min: number;
  max: number;
  average: number;
  quartiles: [number, number, number];
};

export type CompetitorListing = {
  id?: string;
  title: string;
  priceCents?: number | null;
  currency?: string | null;
  reviews?: number | null;
  rating?: number | null;
  salesVolume?: number | null;
  tags?: string[];
  imageCount?: number | null;
  description?: string | null;
};

export type CompetitorInsight = {
  query: string;
  rankedListings: Array<CompetitorListing & { score: number }>;
  priceSummary: NumericSummary;
  reviewSummary: NumericSummary;
  ratingSummary: NumericSummary;
  sharedPhrases: string[];
  commonAdjectives: string[];
  tagOverlap: { tag: string; usage: number }[];
  saturation: { strong: number; weak: number; total: number };
  narrative: string;
};

function calculateNumericSummary(values: number[]): NumericSummary {
  if (!values.length) {
    return { min: 0, max: 0, average: 0, quartiles: [0, 0, 0] };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const medianIndex = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2 : sorted[medianIndex];
  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor((sorted.length * 3) / 4);
  const q1 = sorted[q1Index] ?? median;
  const q3 = sorted[q3Index] ?? median;
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    average: sum / sorted.length,
    quartiles: [q1, median, q3],
  };
}

function estimateListingScore(listing: CompetitorListing): number {
  const reviews = listing.reviews ?? 0;
  const rating = listing.rating ?? 0;
  const sales = listing.salesVolume ?? reviews * (rating / 5);
  const freshnessBoost = (listing.imageCount ?? 1) / 5;
  return reviews * 0.5 + rating * 10 + sales * 0.2 + freshnessBoost;
}

function extractPhrases(listings: CompetitorListing[]): string[] {
  const phraseCounts = new Map<string, number>();
  for (const listing of listings) {
    const text = `${listing.title} ${listing.description ?? ""}`
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
    const words = text.split(/\s+/).filter((word) => word.length > 2);
    for (let index = 0; index < words.length - 1; index += 1) {
      const phrase = `${words[index]} ${words[index + 1]}`;
      phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
    }
  }
  return Array.from(phraseCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([phrase]) => phrase);
}

const ADJECTIVE_HINTS = new Set([
  "luxury",
  "rustic",
  "modern",
  "minimal",
  "boho",
  "custom",
  "personalized",
  "handmade",
  "vintage",
  "organic",
  "classic",
  "bold",
  "elegant",
  "premium",
  "playful",
  "colorful",
]);

function extractAdjectives(listings: CompetitorListing[]): string[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    const tokens = tokenizeForDensity(listing.title ?? "")
      .concat(tokenizeForDensity(listing.description ?? ""));
    for (const token of tokens) {
      if (ADJECTIVE_HINTS.has(token)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function aggregateTags(listings: CompetitorListing[]): { tag: string; usage: number }[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const tag of listing.tags ?? []) {
      const normalized = tag.trim().toLowerCase();
      if (!normalized) {
        continue;
      }
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, usage]) => ({ tag, usage }));
}

function buildNarrative(insight: {
  query: string;
  priceSummary: NumericSummary;
  reviewSummary: NumericSummary;
  saturation: { strong: number; weak: number; total: number };
  sharedPhrases: string[];
  commonAdjectives: string[];
}): string {
  const parts: string[] = [];
  parts.push(`Top sellers for "${insight.query}" cluster between $${(insight.priceSummary.quartiles[1] / 100).toFixed(2)} and $${(insight.priceSummary.quartiles[2] / 100).toFixed(2)}.`);
  if (insight.reviewSummary.average > 0) {
    parts.push(`Average review volume sits around ${(insight.reviewSummary.average).toFixed(0)} with ${(insight.saturation.strong / insight.saturation.total || 0).toLocaleString(undefined, { style: "percent", maximumFractionDigits: 0 })} listings scoring as strong.`);
  }
  if (insight.sharedPhrases.length) {
    parts.push(`Winning phrases: ${insight.sharedPhrases.slice(0, 3).join(", ")}.`);
  }
  if (insight.commonAdjectives.length) {
    parts.push(`Tone skew: ${insight.commonAdjectives.slice(0, 3).join(", ")}.`);
  }
  return parts.join(" ");
}

export function analyzeCompetitors(query: string, listings: CompetitorListing[]): CompetitorInsight {
  const rankedListings = listings
    .map((listing) => ({
      ...listing,
      score: estimateListingScore(listing),
    }))
    .sort((a, b) => b.score - a.score);

  const priceSummary = calculateNumericSummary(
    rankedListings.map((listing) => Number(listing.priceCents ?? 0)).filter((value) => Number.isFinite(value)),
  );
  const reviewSummary = calculateNumericSummary(
    rankedListings.map((listing) => Number(listing.reviews ?? 0)).filter((value) => Number.isFinite(value)),
  );
  const ratingSummary = calculateNumericSummary(
    rankedListings.map((listing) => Number(listing.rating ?? 0)).filter((value) => Number.isFinite(value)),
  );

  let strong = 0;
  let weak = 0;
  for (const listing of rankedListings) {
    const reviewVolume = listing.reviews ?? 0;
    const rating = listing.rating ?? 0;
    if (reviewVolume >= 200 && rating >= 4.7) {
      strong += 1;
    } else if (reviewVolume < 50 || rating < 4.0) {
      weak += 1;
    }
  }

  const insight = {
    query,
    rankedListings,
    priceSummary,
    reviewSummary,
    ratingSummary,
    sharedPhrases: extractPhrases(listings),
    commonAdjectives: extractAdjectives(listings),
    tagOverlap: aggregateTags(listings),
    saturation: { strong, weak, total: rankedListings.length },
  };

  return {
    ...insight,
    narrative: buildNarrative(insight),
  };
}
