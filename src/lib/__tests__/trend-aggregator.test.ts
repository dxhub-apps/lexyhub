import { describe, expect, it } from "vitest";

import { aggregateTrendSignals } from "../trends";

describe("aggregateTrendSignals", () => {
  it("returns combined records with momentum map", async () => {
    const { records, momentumByTerm } = await aggregateTrendSignals(new Date("2024-01-01"));

    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      expect(record.recordedOn).toBe("2024-01-01");
      expect(record.term).toBe(record.term.toLowerCase());
      expect(record.trendScore).toBeGreaterThanOrEqual(0);
      expect(record.velocity).toBeGreaterThanOrEqual(0);
    }

    const entry = momentumByTerm.get("handmade jewelry");
    expect(entry).toBeDefined();
    expect(entry?.momentum).toBeGreaterThan(0);
    expect(entry?.contributors.length).toBeGreaterThan(0);
  });
});
