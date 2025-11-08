export type TrendSignal = {
  term: string;
  source: "google_trends" | "pinterest" | "reddit";
  score: number;
  normalizedScore: number;
  change: number;
  metadata?: Record<string, unknown>;
};

export type TrendSeriesRecord = {
  term: string;
  source: TrendSignal["source"];
  recorded_on: string;
  trend_score: number;
  velocity: number;
  expected_growth_30d: number;
  extras?: Record<string, unknown>;
};

export type AggregatedTrendResult = {
  records: TrendSeriesRecord[];
  momentumByTerm: Map<string, { momentum: number; contributors: string[]; expectedGrowth: number }>;
};
