export const KEYWORD_TELEMETRY_LOOKBACK_DAYS = Object.freeze([1, 7, 30] as const);

type NumberLike = number | string | null | undefined;

export interface KeywordStatAggregate {
  keyword_id: string;
  source: string;
  recorded_on: string;
  search_volume: NumberLike;
  impressions: NumberLike;
  clicks: NumberLike;
  ctr: NumberLike;
  conversion_rate: NumberLike;
  cost_cents: NumberLike;
  rank: NumberLike;
  metadata: Record<string, unknown> | null;
}

export interface KeywordStatIdentity {
  keyword_id: string;
  source: string;
  recorded_on: string;
}

function buildKey({ keyword_id, source, recorded_on }: KeywordStatIdentity): string {
  return `${keyword_id}::${source.toLowerCase()}::${recorded_on}`;
}

function countDefinedMetrics(row: KeywordStatAggregate): number {
  let score = 0;
  const fields: Array<keyof KeywordStatAggregate> = [
    "search_volume",
    "impressions",
    "clicks",
    "ctr",
    "conversion_rate",
    "cost_cents",
    "rank",
  ];

  for (const field of fields) {
    if (row[field] !== null && row[field] !== undefined) {
      score += 1;
    }
  }

  return score;
}

function extractEventCount(row: KeywordStatAggregate): number {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object") {
    return 0;
  }

  const eventCount = (metadata as Record<string, unknown>).eventCount;
  return typeof eventCount === "number" && Number.isFinite(eventCount) ? eventCount : 0;
}

export function getKeywordTelemetryWindowStart(
  now: Date = new Date(),
  lookbackDays: readonly number[] = KEYWORD_TELEMETRY_LOOKBACK_DAYS,
): string {
  if (!Array.isArray(lookbackDays) || lookbackDays.length === 0) {
    throw new Error("lookbackDays must include at least one window length");
  }

  const maxWindow = Math.max(...lookbackDays);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - maxWindow);

  return start.toISOString();
}

export function filterExistingKeywordStats(
  rows: KeywordStatAggregate[],
  existing: KeywordStatIdentity[],
): KeywordStatAggregate[] {
  const existingKeys = new Set(existing.map(buildKey));
  const deduped = new Map<string, KeywordStatAggregate>();

  for (const row of rows) {
    const key = buildKey(row);

    if (existingKeys.has(key)) {
      continue;
    }

    const previous = deduped.get(key);

    if (!previous) {
      deduped.set(key, row);
      continue;
    }

    const previousScore = countDefinedMetrics(previous);
    const candidateScore = countDefinedMetrics(row);

    if (candidateScore > previousScore) {
      deduped.set(key, row);
      continue;
    }

    if (candidateScore === previousScore) {
      const previousEvents = extractEventCount(previous);
      const candidateEvents = extractEventCount(row);

      if (candidateEvents >= previousEvents) {
        deduped.set(key, row);
      }
    }
  }

  return Array.from(deduped.values());
}

export type { KeywordStatAggregate as KeywordTelemetryRow };
