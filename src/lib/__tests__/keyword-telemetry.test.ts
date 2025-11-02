import { describe, expect, it } from "vitest";

import {
  KEYWORD_TELEMETRY_LOOKBACK_DAYS,
  filterExistingKeywordStats,
  getKeywordTelemetryWindowStart,
  type KeywordTelemetryRow,
} from "../keywords/telemetry";

describe("getKeywordTelemetryWindowStart", () => {
  it("returns the UTC start of day minus the largest window", () => {
    const now = new Date("2024-06-15T15:30:45.000Z");
    const start = getKeywordTelemetryWindowStart(now);
    expect(start).toBe("2024-05-16T00:00:00.000Z");
  });

  it("supports custom windows", () => {
    const now = new Date("2024-01-10T12:00:00.000Z");
    const start = getKeywordTelemetryWindowStart(now, [3, 10]);
    expect(start).toBe("2023-12-31T00:00:00.000Z");
  });

  it("throws when windows are missing", () => {
    expect(() => getKeywordTelemetryWindowStart(new Date(), [])).toThrowError(
      /lookbackDays must include at least one window length/,
    );
  });
});

describe("filterExistingKeywordStats", () => {
  const baseRow: KeywordTelemetryRow = {
    keyword_id: "11111111-1111-1111-1111-111111111111",
    source: "etsy",
    recorded_on: "2024-06-14",
    search_volume: 120,
    impressions: 400,
    clicks: 24,
    ctr: 0.06,
    conversion_rate: 0.12,
    cost_cents: 5100,
    rank: 3,
    metadata: { eventCount: 2 },
  };

  it("removes rows that already exist", () => {
    const filtered = filterExistingKeywordStats(
      [baseRow],
      [
        {
          keyword_id: baseRow.keyword_id,
          source: baseRow.source,
          recorded_on: baseRow.recorded_on,
        },
      ],
    );

    expect(filtered).toHaveLength(0);
  });

  it("keeps rows with more defined metrics when duplicates are provided", () => {
    const duplicate: KeywordTelemetryRow = {
      ...baseRow,
      search_volume: null,
      impressions: null,
      clicks: null,
      ctr: null,
      conversion_rate: null,
      cost_cents: null,
      rank: null,
      metadata: { eventCount: 4 },
    };

    const filtered = filterExistingKeywordStats([duplicate, baseRow], []);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject(baseRow);
  });

  it("prefers the row with a higher eventCount when metric counts tie", () => {
    const candidateA: KeywordTelemetryRow = {
      ...baseRow,
      search_volume: 200,
      cost_cents: null,
      metadata: { eventCount: 3 },
    };

    const candidateB: KeywordTelemetryRow = {
      ...baseRow,
      search_volume: 200,
      cost_cents: null,
      metadata: { eventCount: 7 },
    };

    const filtered = filterExistingKeywordStats([candidateA, candidateB], []);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject(candidateB);
  });
});

it("documents the default window configuration", () => {
  expect(Array.from(KEYWORD_TELEMETRY_LOOKBACK_DAYS)).toEqual([1, 7, 30]);
});
