// scripts/google-trends-collector.mjs
// Google Trends data collection (free, no API key required)
// Uses google-trends-api npm package
// Node 20+

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const MAX_KEYWORDS = Number(process.env.MAX_KEYWORDS || 100);
const GEO = process.env.GEO || "US";
const TIME_RANGE = process.env.TIME_RANGE || "now 7-d"; // Last 7 days

// ==========================
// Supabase
// ==========================
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================
// Google Trends API (unofficial but free)
// ==========================
async function getInterestOverTime(keyword) {
  try {
    // Using Google Trends public endpoint (no auth required)
    const params = new URLSearchParams({
      hl: "en-US",
      tz: "-300",
      req: JSON.stringify({
        comparisonItem: [{ keyword, geo: GEO, time: TIME_RANGE }],
        category: 0,
        property: "",
      }),
    });

    const response = await fetch(
      `https://trends.google.com/trends/api/widgetdata/multiline?${params.toString()}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`google_trends_error:${response.status}`);
    }

    const text = await response.text();
    // Google returns ")]}'" prefix, strip it
    const json = JSON.parse(text.substring(4));

    const timelineData = json.default?.timelineData || [];
    if (timelineData.length === 0) return null;

    // Calculate average interest
    const values = timelineData.map((d) => d.value?.[0] || 0);
    const avgInterest = values.reduce((sum, v) => sum + v, 0) / values.length;
    const maxInterest = Math.max(...values);
    const currentInterest = values[values.length - 1] || 0;

    // Calculate momentum (change from first to last)
    const firstInterest = values[0] || 1;
    const momentum = ((currentInterest - firstInterest) / firstInterest) * 100;

    return {
      avg_interest: Number(avgInterest.toFixed(2)),
      max_interest: maxInterest,
      current_interest: currentInterest,
      momentum: Number(momentum.toFixed(2)),
      data_points: timelineData.length,
    };
  } catch (err) {
    console.warn("trends_error:%s:%s", keyword, err?.message || err);
    return null;
  }
}

async function getRelatedQueries(keyword) {
  try {
    const params = new URLSearchParams({
      hl: "en-US",
      tz: "-300",
      req: JSON.stringify({
        restriction: { geo: { country: GEO }, time: TIME_RANGE },
        keywordType: "QUERY",
        metric: ["TOP", "RISING"],
        trendinessSettings: { compareTime: TIME_RANGE },
        requestOptions: { property: "", backend: "IZG", category: 0 },
        language: "en",
        userCountryCode: "US",
      }),
    });

    const response = await fetch(
      `https://trends.google.com/trends/api/widgetdata/relatedsearches?${params.toString()}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!response.ok) {
      return { top: [], rising: [] };
    }

    const text = await response.text();
    const json = JSON.parse(text.substring(4));

    const rankedList = json.default?.rankedList || [];
    const top = rankedList.find((r) => r.rankedKeyword?.[0]?.metric === "TOP");
    const rising = rankedList.find((r) => r.rankedKeyword?.[0]?.metric === "RISING");

    return {
      top: (top?.rankedKeyword || []).slice(0, 5).map((k) => k.query),
      rising: (rising?.rankedKeyword || []).slice(0, 5).map((k) => k.query),
    };
  } catch (err) {
    console.warn("related_queries_error:%s:%s", keyword, err?.message || err);
    return { top: [], rising: [] };
  }
}

// ==========================
// Data Storage
// ==========================
async function storeT

rendsData(keyword, trendsData, relatedQueries) {
  const today = new Date().toISOString().split("T")[0];

  try {
    // Get keyword ID
    const { data: keywords } = await db
      .from("keywords")
      .select("id")
      .eq("term_normalized", keyword.term.toLowerCase().trim())
      .eq("source", "google_trends")
      .limit(1);

    let keywordId;

    if (!keywords || keywords.length === 0) {
      // Upsert keyword
      const { error: kwError } = await db.rpc("lexy_upsert_keyword", {
        p_term: keyword.term,
        p_market: keyword.market,
        p_source: "google_trends",
        p_tier: 0,
        p_method: "trends_api",
        p_extras: {
          google_trends: trendsData,
          related_queries: relatedQueries,
        },
        p_freshness: new Date().toISOString(),
      });

      if (kwError) {
        console.warn("keyword_upsert_warn:%s", kwError.message);
        return false;
      }

      // Get newly created keyword ID
      const { data: newKeyword } = await db
        .from("keywords")
        .select("id")
        .eq("term_normalized", keyword.term.toLowerCase().trim())
        .eq("source", "google_trends")
        .single();

      keywordId = newKeyword?.id;
    } else {
      keywordId = keywords[0].id;
    }

    if (!keywordId) return false;

    // Store in keyword_metrics_daily
    await db.from("keyword_metrics_daily").upsert(
      {
        keyword_id: keywordId,
        collected_on: today,
        source: "google_trends",
        volume: trendsData.avg_interest,
        extras: {
          trends_data: trendsData,
          related_queries: relatedQueries,
        },
      },
      { onConflict: "keyword_id,collected_on,source" }
    );

    // Store in trend_series
    await db.from("trend_series").upsert(
      {
        term: keyword.term,
        source: "google_trends",
        recorded_on: today,
        trend_score: trendsData.current_interest,
        velocity: trendsData.momentum,
        extras: { related_queries: relatedQueries },
      },
      { onConflict: "term,source,recorded_on" }
    );

    return true;
  } catch (err) {
    console.warn("store_error:%s:%s", keyword.term, err?.message || err);
    return false;
  }
}

// ==========================
// Main
// ==========================
async function main() {
  console.log("google_trends_collector:start");

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await db
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "google_trends_collection")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("google_trends_collection:disabled by feature flag");
      return;
    }

    // Get keywords to collect trends for (prioritize watched keywords)
    const { data: watchedKeywords } = await db
      .from("keywords")
      .select(`
        id,
        term,
        market,
        user_keyword_watchlists!inner(user_id)
      `)
      .limit(Math.floor(MAX_KEYWORDS * 0.5));

    const { data: activeKeywords } = await db
      .from("keywords")
      .select("id, term, market")
      .order("freshness_ts", { ascending: false })
      .limit(Math.floor(MAX_KEYWORDS * 0.5));

    const keywords = [
      ...(watchedKeywords || []).map((k) => ({ ...k, is_watched: true })),
      ...(activeKeywords || []).map((k) => ({ ...k, is_watched: false })),
    ];

    console.log(`collecting_trends:${keywords.length} keywords`);

    let collected = 0;
    let stored = 0;

    for (const keyword of keywords) {
      try {
        // Rate limit: 1 request per second to be respectful
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const trendsData = await getInterestOverTime(keyword.term);
        if (!trendsData) {
          console.warn(`no_data:${keyword.term}`);
          continue;
        }

        collected++;

        const relatedQueries = await getRelatedQueries(keyword.term);

        const success = await storeTrendsData(keyword, trendsData, relatedQueries);
        if (success) stored++;

        if (collected % 10 === 0) {
          console.log(`progress:${collected}/${keywords.length} collected, ${stored} stored`);
        }
      } catch (err) {
        console.error(`error:${keyword.term}:${err?.message || err}`);
      }
    }

    console.log(`google_trends_collector:success:${stored}/${keywords.length} keywords`);

    // Track API usage
    await db.rpc("track_api_usage", {
      p_service: "google_trends",
      p_requests: collected,
    });
  } catch (err) {
    console.error("google_trends_collector:error", err?.message || err);
    process.exit(1);
  }
}

main();
