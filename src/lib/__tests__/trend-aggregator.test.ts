import { afterAll, describe, expect, it, vi } from "vitest";

import { aggregateTrendSignals } from "../trends";
import * as trendSources from "../trends/sources";

describe("aggregateTrendSignals", () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("combines signals, averages metrics, and deduplicates contributors", async () => {
    vi.spyOn(trendSources, "fetchGoogleTrendsSignals").mockResolvedValue([
      {
        term: "Eco Mug",
        source: "google_trends",
        score: 80,
        normalizedScore: 0.8,
        change: 0.5,
        metadata: { region: "us" },
      },
    ]);

    vi.spyOn(trendSources, "fetchPinterestTrendSignals").mockResolvedValue([
      {
        term: "eco mug",
        source: "pinterest",
        score: 70,
        normalizedScore: 0.7,
        change: 0.4,
        metadata: { board: "kitchen" },
      },
      {
        term: "Solar Lamp",
        source: "pinterest",
        score: 60,
        normalizedScore: 0.6,
        change: 0.3,
        metadata: { board: "garden" },
      },
    ]);

    vi.spyOn(trendSources, "fetchRedditTrendSignals").mockResolvedValue([
      {
        term: "Eco Mug",
        source: "reddit",
        score: 50,
        normalizedScore: 0.5,
        change: 0.6,
        metadata: { subreddit: "sustainability" },
      },
    ]);

    const { records, momentumByTerm } = await aggregateTrendSignals(new Date("2024-01-01"));

    expect(records).toHaveLength(4);
    expect(records.map((record) => record.term)).toEqual([
      "eco mug",
      "eco mug",
      "solar lamp",
      "eco mug",
    ]);

    const ecoMomentum = momentumByTerm.get("eco mug");
    const solarMomentum = momentumByTerm.get("solar lamp");

    expect(ecoMomentum).toBeDefined();
    expect(ecoMomentum?.contributors).toEqual(["google_trends", "pinterest", "reddit"]);

    const expectedGoogleMomentum = Number((0.8 * 0.6 + 0.5 * 0.4).toFixed(4));
    const expectedPinterestMomentum = Number((0.7 * 0.6 + 0.4 * 0.4).toFixed(4));
    const expectedRedditMomentum = Number((0.5 * 0.6 + 0.6 * 0.4).toFixed(4));
    const expectedAverageMomentum = Number(
      (((expectedGoogleMomentum + expectedPinterestMomentum) / 2 + expectedRedditMomentum) / 2).toFixed(4),
    );
    expect(ecoMomentum?.momentum).toBe(expectedAverageMomentum);

    const expectedGoogleGrowth = Number((0.8 * 0.5 + 0.5 * 0.75).toFixed(4));
    const expectedPinterestGrowth = Number((0.7 * 0.5 + 0.4 * 0.75).toFixed(4));
    const expectedRedditGrowth = Number((0.5 * 0.5 + 0.6 * 0.75).toFixed(4));
    const expectedAverageGrowth = Number(
      (((expectedGoogleGrowth + expectedPinterestGrowth) / 2 + expectedRedditGrowth) / 2).toFixed(4),
    );
    expect(ecoMomentum?.expectedGrowth).toBe(expectedAverageGrowth);

    expect(solarMomentum).toEqual({
      momentum: Number((0.6 * 0.6 + 0.3 * 0.4).toFixed(4)),
      expectedGrowth: Number(((0.6 * 0.5 + 0.3 * 0.75)).toFixed(4)),
      contributors: ["pinterest"],
    });
  });
});
