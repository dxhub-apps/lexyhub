export type ListingIntent = "gift" | "home" | "fashion" | "craft" | "unknown";
export type ListingTone = "positive" | "neutral" | "urgent" | "luxury" | "playful" | "unknown";

export type ListingInput = {
  id?: string;
  title: string;
  description?: string;
  tags?: string[];
  materials?: string[];
  categories?: string[];
  priceCents?: number | null;
  currency?: string | null;
  reviews?: number | null;
  rating?: number | null;
  salesVolume?: number | null;
  attributes?: Record<string, string | null>;
};

export type KeywordDensity = {
  keyword: string;
  occurrences: number;
  density: number;
};

export type ListingQuickFix = {
  id: string;
  title: string;
  description: string;
};

export type ListingIntelligenceReport = {
  qualityScore: number;
  completeness: number;
  sentiment: number;
  readability: number;
  keywordDensity: KeywordDensity[];
  intent: ListingIntent;
  tone: ListingTone;
  missingAttributes: string[];
  quickFixes: ListingQuickFix[];
};

const STOPWORDS = new Set(
  [
    "a",
    "an",
    "the",
    "and",
    "or",
    "to",
    "for",
    "with",
    "on",
    "in",
    "of",
    "this",
    "that",
    "is",
    "are",
    "by",
    "from",
    "it",
    "your",
    "you",
    "be",
    "at",
    "as",
  ].map((word) => word.toLowerCase()),
);

const POSITIVE_WORDS = new Set([
  "beautiful",
  "handmade",
  "premium",
  "unique",
  "luxury",
  "gift",
  "perfect",
  "love",
  "favorite",
  "best",
  "limited",
  "artisan",
  "organic",
  "sustainable",
]);

const NEGATIVE_WORDS = new Set([
  "damaged",
  "cheap",
  "imperfect",
  "broken",
  "delay",
  "issue",
  "problem",
  "flaw",
  "scratch",
  "seconds",
  "used",
]);

const MATERIAL_KEYS = ["materials", "material", "fabric", "wood", "metal"];
const DIMENSION_KEYS = ["dimensions", "width", "height", "length", "size"];

function tokenize(text: string | undefined): string[] {
  if (!text) {
    return [];
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function calculateKeywordDensity(tokens: string[]): KeywordDensity[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  const total = tokens.length || 1;
  const entries = Array.from(counts.entries())
    .map(([keyword, occurrences]) => ({
      keyword,
      occurrences,
      density: occurrences / total,
    }))
    .sort((a, b) => b.density - a.density)
    .slice(0, 15);

  return entries;
}

function countSyllables(word: string): number {
  const normalized = word.toLowerCase();
  if (normalized.length <= 3) {
    return 1;
  }
  return (
    normalized
      .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/g, "")
      .replace(/^y/, "")
      .match(/[aeiouy]{1,2}/g)?.length ?? 1
  );
}

function calculateReadabilityScore(text: string | undefined): number {
  if (!text) {
    return 0.5;
  }
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  const words = tokenize(text);
  if (!sentences.length || !words.length) {
    return 0.5;
  }
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = syllables / words.length;
  const flesch = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(1, flesch / 100));
}

function sentimentScore(text: string | undefined): number {
  if (!text) {
    return 0;
  }
  const tokens = tokenize(text);
  if (!tokens.length) {
    return 0;
  }
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) {
      score += 1;
    } else if (NEGATIVE_WORDS.has(token)) {
      score -= 1;
    }
  }
  return Math.max(-1, Math.min(1, score / Math.sqrt(tokens.length)));
}

function detectIntent(listing: ListingInput): ListingIntent {
  const haystack = [listing.title, listing.description, ...(listing.tags ?? []), ...(listing.categories ?? [])]
    .join(" ")
    .toLowerCase();
  if (haystack.includes("wedding") || haystack.includes("gift")) {
    return "gift";
  }
  if (haystack.includes("wall art") || haystack.includes("decor") || haystack.includes("home")) {
    return "home";
  }
  if (haystack.includes("shirt") || haystack.includes("jewelry") || haystack.includes("dress")) {
    return "fashion";
  }
  if (haystack.includes("pattern") || haystack.includes("digital download") || haystack.includes("diy")) {
    return "craft";
  }
  return "unknown";
}

function detectTone(listing: ListingInput): ListingTone {
  const haystack = `${listing.title} ${listing.description ?? ""}`.toLowerCase();
  if (haystack.includes("limited")) {
    return "urgent";
  }
  if (haystack.includes("luxury") || haystack.includes("premium")) {
    return "luxury";
  }
  if (haystack.includes("fun") || haystack.includes("playful")) {
    return "playful";
  }
  const sentiment = sentimentScore(haystack);
  if (sentiment > 0.3) {
    return "positive";
  }
  if (sentiment < -0.3) {
    return "urgent";
  }
  return "neutral";
}

function detectMissingAttributes(listing: ListingInput): string[] {
  const missing: string[] = [];
  const attributes = listing.attributes ?? {};
  const tokens = tokenize(listing.description);
  const descriptionHasMaterial = tokens.some((token) => MATERIAL_KEYS.includes(token));
  const descriptionHasDimensions = tokens.some((token) => DIMENSION_KEYS.includes(token));

  if (!listing.materials?.length && !descriptionHasMaterial) {
    missing.push("materials");
  }
  if (!listing.categories?.length) {
    missing.push("categories");
  }
  if (!attributes.dimensions && !descriptionHasDimensions) {
    missing.push("dimensions");
  }
  if (!listing.tags?.length || listing.tags.filter(Boolean).length < 5) {
    missing.push("tags");
  }
  if (!listing.description || listing.description.trim().length < 80) {
    missing.push("description depth");
  }
  return missing;
}

function buildQuickFixes(listing: ListingInput, missing: string[], keywordDensity: KeywordDensity[]): ListingQuickFix[] {
  const fixes: ListingQuickFix[] = [];
  if (missing.includes("materials")) {
    fixes.push({
      id: "materials",
      title: "Add material details",
      description: "Describe the primary materials (e.g., sterling silver, organic cotton) to boost buyer confidence.",
    });
  }
  if (missing.includes("dimensions")) {
    fixes.push({
      id: "dimensions",
      title: "Provide measurements",
      description: "List width, height, and depth to reduce pre-purchase questions and returns.",
    });
  }
  if (missing.includes("tags")) {
    const bestKeyword = keywordDensity[0]?.keyword;
    fixes.push({
      id: "tags",
      title: "Expand discoverability tags",
      description:
        bestKeyword
          ? `Incorporate keywords like \"${bestKeyword}\" and remove duplicates to maximize search reach.`
          : "Add at least 10 descriptive tags that match how shoppers search for the item.",
    });
  }
  if (missing.includes("description depth")) {
    fixes.push({
      id: "description",
      title: "Enrich the story",
      description: "Write 3–4 sentences covering materials, craftsmanship, and usage scenarios.",
    });
  }
  if (!missing.includes("description depth") && listing.description && sentimentScore(listing.description) < 0) {
    fixes.push({
      id: "sentiment",
      title: "Reframe negative phrasing",
      description: "Highlight benefits and eliminate apologies or caveats that diminish trust.",
    });
  }
  return fixes;
}

function normalizeScore(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  return (clamped - min) / (max - min || 1);
}

function calculateCompletenessScore(listing: ListingInput, missing: string[]): number {
  const signals = [
    listing.description?.trim().length ?? 0,
    listing.tags?.length ?? 0,
    listing.materials?.length ?? 0,
    listing.categories?.length ?? 0,
    listing.rating ?? 0,
  ];
  const normalizedSignals = signals.map((value) => normalizeScore(value, 0, value > 5 ? value : 10));
  const base = normalizedSignals.reduce((sum, value) => sum + value, 0) / normalizedSignals.length;
  const penalty = missing.length ? Math.min(0.3, missing.length * 0.05) : 0;
  return Math.max(0, Math.min(1, base - penalty));
}

function calculateQualityScore(
  completeness: number,
  sentiment: number,
  readability: number,
  keywordDensity: KeywordDensity[],
  missingAttributes: string[],
): number {
  const keywordSignal = keywordDensity.length ? Math.min(1, keywordDensity[0].density * 5) : 0.2;
  const penalty = missingAttributes.length * 0.04;
  const raw = completeness * 0.45 + ((sentiment + 1) / 2) * 0.25 + readability * 0.2 + keywordSignal * 0.1 - penalty;
  return Math.max(0, Math.min(1, raw));
}

export function analyzeListing(listing: ListingInput): ListingIntelligenceReport {
  const tokens = tokenize(`${listing.title} ${listing.description ?? ""}`);
  const keywordDensity = calculateKeywordDensity(tokens);
  const readability = calculateReadabilityScore(listing.description);
  const sentiment = sentimentScore(listing.description);
  const missingAttributes = detectMissingAttributes(listing);
  const completeness = calculateCompletenessScore(listing, missingAttributes);
  const qualityScore = calculateQualityScore(completeness, sentiment, readability, keywordDensity, missingAttributes);
  const quickFixes = buildQuickFixes(listing, missingAttributes, keywordDensity);

  return {
    qualityScore,
    completeness,
    sentiment,
    readability,
    keywordDensity,
    intent: detectIntent(listing),
    tone: detectTone(listing),
    missingAttributes,
    quickFixes,
  };
}
