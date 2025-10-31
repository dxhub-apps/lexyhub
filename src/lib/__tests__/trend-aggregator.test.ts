import { describe, expect, it } from "vitest";

import { aggregateTrendSignals } from "../trends";

describe("aggregateTrendSignals", () => {
  it("returns combined records with momentum map", async () => {
    const { records, momentumByTerm } = await aggregateTrendSignals(new Date("2024-01-01"));

    expect(Array.isArray(records)).toBe(true);
    if (records.length > 0) {
      for (const record of records) {
        expect(record.recordedOn).toBe("2024-01-01");
        expect(record.term).toBe(record.term.toLowerCase());
        expect(record.trendScore).toBeGreaterThanOrEqual(0);
        expect(record.velocity).toBeGreaterThanOrEqual(0);
      }

      expect(momentumByTerm.size).toBeGreaterThan(0);
    } else {
      expect(momentumByTerm.size).toBe(0);
    }
  });
});
