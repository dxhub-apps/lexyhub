export type KeywordSample = {
  id: string;
  position: number | null;
  source: string | null;
  title: string | null;
  url: string | null;
  tags: string[];
  capturedAt: string | null;
  totalResults: number | null;
  derivedMetrics: Record<string, unknown> | null;
  listing: { id: string | null; title: string | null; url: string | null } | null;
};

export type KeywordDetailPayload = {
  keywordId: string;
  keywordTerm: string | null;
  keywordMarket: string | null;
  provenanceId?: string | null;
  source: string | null;
  capturedAt: string | null;
  totalResults: number | null;
  samples: KeywordSample[];
  listingExamples: Array<{ id: string | null; title: string | null; url: string | null }>;
  summary: { tags: string[]; derivedMetrics: Record<string, unknown> | null } | null;
};
