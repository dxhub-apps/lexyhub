const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "have",
  "was",
  "were",
  "will",
  "would",
]);

export function tokenizeForDensity(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}
