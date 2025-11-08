import { fetchGoogleTrendsSignals, fetchPinterestTrendSignals, fetchRedditTrendSignals } from "./sources";
import type { AggregatedTrendResult, TrendSeriesRecord, TrendSignal } from "./types";

function calculateMomentum(signal: TrendSignal): number {
  const velocity = signal.change;
  const weighted = signal.normalizedScore * 0.6 + velocity * 0.4;
  return Math.max(0, Math.min(1.5, weighted));
}

function calculateExpectedGrowth(signal: TrendSignal): number {
  const baseGrowth = signal.normalizedScore * 0.5;
  const momentumGrowth = signal.change * 0.75;
  return Math.max(0, Number((baseGrowth + momentumGrowth).toFixed(4)));
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

export async function aggregateTrendSignals(date: Date = new Date()): Promise<AggregatedTrendResult> {
  const [google, pinterest, reddit] = await Promise.all([
    fetchGoogleTrendsSignals(),
    fetchPinterestTrendSignals(),
    fetchRedditTrendSignals(),
  ]);

  const signals = [...google, ...pinterest, ...reddit];
  const recordedOn = date.toISOString().slice(0, 10);

  const records: TrendSeriesRecord[] = signals.map((signal) => ({
    term: normalizeTerm(signal.term),
    source: signal.source,
    recorded_on: recordedOn,
    trend_score: Number(signal.normalizedScore.toFixed(4)),
    velocity: Number(signal.change.toFixed(4)),
    expected_growth_30d: calculateExpectedGrowth(signal),
    extras: { rawScore: signal.score, metadata: signal.metadata },
  }));

  const momentumByTerm = new Map<string, { momentum: number; contributors: string[]; expectedGrowth: number }>();

  for (const record of records) {
    const existing = momentumByTerm.get(record.term);
    const momentum = calculateMomentum({
      term: record.term,
      source: record.source,
      score: record.trend_score,
      normalizedScore: record.trend_score,
      change: record.velocity,
      metadata: record.extras,
    });
    if (existing) {
      const nextMomentum = Number(((existing.momentum + momentum) / 2).toFixed(4));
      const nextGrowth = Number(((existing.expectedGrowth + record.expected_growth_30d) / 2).toFixed(4));
      momentumByTerm.set(record.term, {
        momentum: nextMomentum,
        expectedGrowth: nextGrowth,
        contributors: Array.from(new Set([...existing.contributors, record.source])),
      });
    } else {
      momentumByTerm.set(record.term, {
        momentum: Number(momentum.toFixed(4)),
        expectedGrowth: record.expected_growth_30d,
        contributors: [record.source],
      });
    }
  }

  return { records, momentumByTerm };
}

export type { TrendSeriesRecord, TrendSignal } from "./types";
