import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

describe("Demand Index and Trend Momentum", () => {
  let supabase: ReturnType<typeof createClient>;
  let testKeywordId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Create test keyword
    const { data: keyword, error: kwError } = await supabase
      .from("keywords")
      .insert({
        term: "test-seasonal-keyword",
        source: "test",
        market: "us",
      })
      .select("id")
      .single();

    if (kwError) throw kwError;
    testKeywordId = keyword.id;

    // Insert test metrics
    const today = new Date().toISOString().split("T")[0];
    const metrics = Array.from({ length: 14 }, (_, i) => ({
      keyword_id: testKeywordId,
      collected_on: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      volume: 1000 + i * 100,
      traffic_rank: 50000 - i * 1000,
      competition_score: 50 + i * 2,
      engagement: 60 + i,
      ai_confidence: 0.9,
      source: "test",
    }));

    await supabase.from("keyword_metrics_daily").insert(metrics);
  });

  afterAll(async () => {
    // Cleanup
    await supabase
      .from("keyword_metrics_daily")
      .delete()
      .eq("keyword_id", testKeywordId);

    await supabase.from("keywords").delete().eq("id", testKeywordId);
  });

  it("should compute base demand index", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("compute_base_demand_index", {
      _kw: testKeywordId,
      _as_of: today,
      _source: "test",
    });

    expect(error).toBeNull();
    expect(data).toBeTypeOf("number");
    expect(data).toBeGreaterThan(0);
    expect(data).toBeLessThanOrEqual(100);
  });

  it("should compute adjusted demand index with seasonality", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("compute_adjusted_demand_index", {
      _kw: testKeywordId,
      _as_of: today,
      _source: "test",
      _country: "global",
    });

    expect(error).toBeNull();
    expect(data).toBeTypeOf("number");
    expect(data).toBeGreaterThan(0);
    expect(data).toBeLessThanOrEqual(100);
  });

  it("should compute trend momentum", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("compute_trend_momentum", {
      _kw: testKeywordId,
      _as_of: today,
      _source: "test",
      _lookback: 7,
    });

    expect(error).toBeNull();
    expect(data).toBeTypeOf("number");
    // Trend momentum can be negative, zero, or positive
    expect(data).toBeGreaterThan(-100);
    expect(data).toBeLessThan(100);
  });

  it("should compute deseasoned trend momentum", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("compute_deseasoned_tm", {
      _kw: testKeywordId,
      _as_of: today,
      _source: "test",
      _lookback: 7,
    });

    expect(error).toBeNull();
    expect(data).toBeTypeOf("number");
    expect(data).toBeGreaterThan(-200);
    expect(data).toBeLessThan(200);
  });

  it("should retrieve current season weight", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("current_season_weight", {
      _as_of: today,
      _country: "global",
    });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("should apply demand trends for date", async () => {
    const today = new Date().toISOString().split("T")[0];

    const { data: updateCount, error } = await supabase.rpc(
      "apply_demand_trend_for_date",
      {
        _as_of: today,
        _source: "test",
        _country: "global",
        _lookback: 7,
      }
    );

    expect(error).toBeNull();
    expect(updateCount).toBeGreaterThanOrEqual(0);

    // Verify keyword was updated
    const { data: keyword, error: kwError } = await supabase
      .from("keywords")
      .select("base_demand_index, adjusted_demand_index, trend_momentum, deseasoned_trend_momentum")
      .eq("id", testKeywordId)
      .single();

    expect(kwError).toBeNull();
    expect(keyword?.base_demand_index).toBeTypeOf("number");
    expect(keyword?.adjusted_demand_index).toBeTypeOf("number");
  });

  it("should query v_keywords_scored view", async () => {
    const { data, error } = await supabase
      .from("v_keywords_scored")
      .select("*")
      .eq("id", testKeywordId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data?.term).toBe("test-seasonal-keyword");
    expect(data?.opportunity_badge).toBeDefined();
  });

  it("should categorize opportunity badges correctly", async () => {
    // Update keyword with specific values
    await supabase
      .from("keywords")
      .update({
        adjusted_demand_index: 75,
        trend_momentum: 12,
      })
      .eq("id", testKeywordId);

    const { data, error } = await supabase
      .from("v_keywords_scored")
      .select("opportunity_badge")
      .eq("id", testKeywordId)
      .single();

    expect(error).toBeNull();
    expect(data?.opportunity_badge).toBe("hot");
  });

  it("should handle missing metrics gracefully", async () => {
    // Create keyword without metrics
    const { data: emptyKeyword, error: kwError } = await supabase
      .from("keywords")
      .insert({
        term: "test-empty-keyword",
        source: "test",
        market: "us",
      })
      .select("id")
      .single();

    expect(kwError).toBeNull();

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("compute_base_demand_index", {
      _kw: emptyKeyword.id,
      _as_of: today,
      _source: "test",
    });

    expect(error).toBeNull();
    expect(data).toBeNull();

    // Cleanup
    await supabase.from("keywords").delete().eq("id", emptyKeyword.id);
  });

  it("should respect seasonal period weights", async () => {
    // Check if Q4 Global Uplift applies
    const q4Date = "2024-11-15"; // During Q4 uplift period

    const { data: seasonWeight, error } = await supabase.rpc(
      "current_season_weight",
      {
        _as_of: q4Date,
        _country: "global",
      }
    );

    expect(error).toBeNull();
    if (Array.isArray(seasonWeight) && seasonWeight.length > 0) {
      expect(seasonWeight[0].weight).toBeGreaterThanOrEqual(1.0);
    }
  });
});
