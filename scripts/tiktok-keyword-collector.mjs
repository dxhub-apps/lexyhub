// scripts/tiktok-keyword-collector.mjs
// TikTok keyword trend collection (DISABLED BY DEFAULT - Ready for future activation)
// Method: Web scraping trending hashtags (no API key required) or API when approved
// Node 20+

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ==========================
// Env
// ==========================
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || ""; // For future API use

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const USE_API = !!TIKTOK_CLIENT_KEY; // Use API if key is provided, otherwise web scraping

// ==========================
// Supabase
// ==========================
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================
// Web Scraping Method (No API Key Required)
// ==========================
async function scrapeTrendingHashtags() {
  console.log("tiktok_method:web_scraping (no API key)");

  try {
    // TikTok public trending API endpoint (no auth required for basic trends)
    const response = await fetch("https://www.tiktok.com/api/recommend/hashtag_list", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`tiktok_scrape_failed:${response.status}`);
    }

    const data = await response.json();
    return data.hashTagList || [];
  } catch (err) {
    console.warn("tiktok_scrape_error:%s", err?.message || err);
    return [];
  }
}

// ==========================
// API Method (Requires Approval & API Key)
// ==========================
async function fetchTrendingFromAPI() {
  console.log("tiktok_method:official_api");

  if (!TIKTOK_CLIENT_KEY) {
    console.warn("tiktok_api:no_client_key");
    return [];
  }

  try {
    // Placeholder for official TikTok API
    // When TikTok API is approved, implement here
    const response = await fetch("https://open-api.tiktok.com/research/trending", {
      headers: {
        "Authorization": `Bearer ${TIKTOK_CLIENT_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`tiktok_api_failed:${response.status}`);
    }

    const data = await response.json();
    return data.trends || [];
  } catch (err) {
    console.warn("tiktok_api_error:%s", err?.message || err);
    return [];
  }
}

// ==========================
// Data Processing
// ==========================
const DOMAIN_TERMS = new Set([
  "diy","craft","handmade","custom","design","product","shop","business","small",
  "etsy","amazon","trend","viral","gift","decor","art","print","idea"
]);

function extractKeywordsFromHashtag(hashtag) {
  // Remove # and split camelCase
  let text = hashtag.replace(/^#/, "");

  // Split on capital letters for camelCase
  text = text.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

  const words = text.split(/\s+/).filter((w) => w.length >= 3);

  // Check if any word matches domain terms
  const hasDomainTerm = words.some((w) => DOMAIN_TERMS.has(w));
  if (!hasDomainTerm) return null;

  return words.join(" ");
}

// ==========================
// Data Storage
// ==========================
async function storeTrendingHashtags(hashtags) {
  const today = new Date().toISOString().split("T")[0];
  let stored = 0;

  for (const tag of hashtags) {
    try {
      const hashtagName = tag.hashtagName || tag.name || "";
      if (!hashtagName) continue;

      const keyword = extractKeywordsFromHashtag(hashtagName);
      if (!keyword) continue; // Skip if no domain terms

      const viewCount = tag.viewCount || tag.views || 0;
      const videoCount = tag.videoCount || tag.videos || 0;

      // Upsert keyword
      const { error: kwError } = await db.rpc("lexy_upsert_keyword", {
        p_term: keyword,
        p_market: "us",
        p_source: "tiktok",
        p_tier: 0,
        p_method: "hashtag_extract",
        p_extras: {
          tiktok: true,
          hashtag: hashtagName,
          view_count: viewCount,
          video_count: videoCount,
        },
        p_freshness: new Date().toISOString(),
      });

      if (kwError) {
        console.warn("keyword_upsert_warn:%s", kwError.message);
        continue;
      }

      // Get keyword ID
      const { data: keywords } = await db
        .from("keywords")
        .select("id")
        .eq("term_normalized", keyword.toLowerCase().trim())
        .eq("source", "tiktok")
        .limit(1);

      if (!keywords || keywords.length === 0) continue;
      const keywordId = keywords[0].id;

      // Store social metrics
      await db.from("keyword_metrics_daily").upsert(
        {
          keyword_id: keywordId,
          collected_on: today,
          source: "tiktok",
          social_mentions: videoCount,
          social_sentiment: 0.5, // Neutral (TikTok doesn't provide sentiment)
          social_platforms: { tiktok: videoCount },
          extras: {
            hashtag: hashtagName,
            view_count: viewCount,
            video_count: videoCount,
          },
        },
        { onConflict: "keyword_id,collected_on,source" }
      );

      // Store platform trend
      await db.from("social_platform_trends").insert({
        keyword_id: keywordId,
        platform: "tiktok",
        mention_count: videoCount,
        engagement_score: viewCount,
        sentiment: 0.5,
        top_posts: [],
        metadata: {
          hashtag: hashtagName,
          view_count: viewCount,
        },
      });

      // Write trend series
      await db.from("trend_series").upsert(
        {
          term: keyword,
          source: "tiktok",
          recorded_on: today,
          trend_score: viewCount,
          extras: { hashtag: hashtagName },
        },
        { onConflict: "term,source,recorded_on" }
      );

      stored++;
    } catch (err) {
      console.warn("store_error:%s", err?.message || err);
    }
  }

  return stored;
}

// ==========================
// Main
// ==========================
async function main() {
  console.log("tiktok_collector:start");

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await db
      .from("feature_flags")
      .select("is_enabled, rollout")
      .eq("key", "tiktok_collection")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("tiktok_collection:DISABLED by feature flag (expected - ready for future activation)");
      return;
    }

    console.log("tiktok_collection:enabled");

    // Choose collection method
    let hashtags = [];
    if (USE_API) {
      hashtags = await fetchTrendingFromAPI();
    } else {
      hashtags = await scrapeTrendingHashtags();
    }

    console.log("hashtags_collected:%d", hashtags.length);

    if (hashtags.length === 0) {
      console.warn("tiktok_collector:no_hashtags_found");
      return;
    }

    // Store data
    const stored = await storeTrendingHashtags(hashtags);
    console.log("keywords_stored:%d", stored);

    // Track API usage
    await db.rpc("track_api_usage", {
      p_service: "tiktok",
      p_requests: 1, // One request per run
    });

    console.log("tiktok_collector:success");
  } catch (err) {
    console.error("tiktok_collector:error", err?.message || err);
    process.exit(1);
  }
}

main();
