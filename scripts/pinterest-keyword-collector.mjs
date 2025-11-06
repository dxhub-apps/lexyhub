// scripts/pinterest-keyword-collector.mjs
// Pinterest keyword trend collection using Pinterest API Basic Access
// Works with: pins:read, boards:read, user_accounts:read
// Collects keywords from user's own boards and pins
// Limits: 200 requests/day
// Node 20+

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ==========================
// Env
// ==========================
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const PINTEREST_ACCESS_TOKEN = process.env.PINTEREST_ACCESS_TOKEN || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

if (!PINTEREST_ACCESS_TOKEN) {
  console.error("Missing PINTEREST_ACCESS_TOKEN");
  process.exit(2);
}

// Daily limit tracking
const DAILY_LIMIT = Number(process.env.PINTEREST_DAILY_LIMIT || 200);
const PER_RUN_BUDGET = Number(process.env.PINTEREST_PER_RUN_BUDGET || Math.floor(DAILY_LIMIT / 12)); // 12 runs per day (every 2 hours)

// Categories to rotate through
const CATEGORIES = [
  "diy_and_crafts",
  "home_decor",
  "weddings",
  "gifts",
  "fashion",
  "art",
  "food_and_drink",
  "beauty",
];

// Product-focused search queries
const SEARCH_QUERIES = [
  "handmade gifts",
  "personalized",
  "custom design",
  "print on demand",
  "etsy products",
  "trending products",
  "small business",
];

const NGRAM_MIN = 2;
const NGRAM_MAX = 5;
const MIN_SAVES = 5; // Minimum saves to consider (strong purchase intent indicator)

// ==========================
// Supabase
// ==========================
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================
// Sentiment Analysis
// ==========================
const POSITIVE_WORDS = new Set([
  "love","excellent","amazing","best","great","awesome","perfect","fantastic","wonderful","brilliant",
  "beautiful","gorgeous","stunning","elegant","chic","trendy","unique","creative","inspiring","quality",
  "must","need","want","buy","gift","present","wedding","party","decor","ideas"
]);

const NEGATIVE_WORDS = new Set([
  "bad","worst","terrible","awful","horrible","poor","disappointing","ugly","cheap","tacky",
  "failed","failing","hate","avoid","warning","don't","overpriced","expensive"
]);

function analyzeSentiment(text) {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  let wordCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) {
      score++;
      wordCount++;
    } else if (NEGATIVE_WORDS.has(word)) {
      score--;
      wordCount++;
    }
  }

  if (wordCount === 0) return 0;
  const normalized = score / Math.max(wordCount, 1);
  return Math.max(-1, Math.min(1, normalized));
}

// ==========================
// Pinterest API Helpers
// ==========================
async function pinterestGET(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.pinterest.com/v5/${endpoint}${qs ? "?" + qs : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${PINTEREST_ACCESS_TOKEN}`,
      "User-Agent": "lexyhub/1.0",
    },
  });

  if (response.status === 429) {
    const resetTime = response.headers.get("x-ratelimit-reset");
    throw new Error(`rate_limited:reset_at:${resetTime}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`pinterest_error:${response.status}:${text}`);
  }

  return response.json();
}

// Get user's boards (works with basic boards:read permission)
async function getUserBoards() {
  try {
    const data = await pinterestGET("boards", {
      page_size: 25,
    });

    return data.items || [];
  } catch (err) {
    console.warn("boards_error:%s", err?.message || err);
    return [];
  }
}

// Get pins from a specific board (works with basic pins:read permission)
async function getBoardPins(boardId, maxResults = 25) {
  try {
    const data = await pinterestGET(`boards/${boardId}/pins`, {
      page_size: Math.min(maxResults, 50),
    });

    return data.items || [];
  } catch (err) {
    console.warn("board_pins_error:%s:%s", boardId, err?.message || err);
    return [];
  }
}

// ==========================
// Text Processing
// ==========================
const DOMAIN_TERMS = new Set([
  "diy","craft","crafts","handmade","custom","personalized","design","decor","gift","gifts",
  "wedding","party","home","print","art","printable","template","idea","ideas","product",
  "small","business","etsy","shop","seller","vintage","unique","creative","inspiration"
]);

function sanitizeText(text) {
  if (!text) return "";
  let t = text.replace(/https?:\/\/\S+/g, " "); // Remove URLs
  t = t.replace(/[@#]\w+/g, " "); // Remove mentions/hashtags
  t = t.replace(/[^\w\s-]/g, " "); // Remove special chars
  return t;
}

function tokenize(text) {
  const t = sanitizeText(text).toLowerCase();
  return t
    .split(/\s+/)
    .filter((w) => {
      if (!w || w.length > 40 || w.length < 2) return false;
      if (!/^[a-z][a-z-]*$/.test(w)) return false;
      return true;
    });
}

function extractPhrases(title, description) {
  const text = (title || "") + " " + (description || "");
  const tokens = tokenize(text);
  const phrases = new Map();

  for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      const phrase = tokens.slice(i, i + n);

      // Must contain at least one domain term
      if (!phrase.some((w) => DOMAIN_TERMS.has(w))) continue;

      const phraseStr = phrase.join(" ");
      if (phraseStr.length < 8) continue;

      phrases.set(phraseStr, true);
    }
  }

  return Array.from(phrases.keys());
}

// ==========================
// Seasonal Detection
// ==========================
const SEASONAL_KEYWORDS = {
  christmas: { months: [11, 12], leadTime: 60 },
  halloween: { months: [10], leadTime: 45 },
  valentine: { months: [2], leadTime: 30 },
  "mother's day": { months: [5], leadTime: 30 },
  "father's day": { months: [6], leadTime: 30 },
  easter: { months: [3, 4], leadTime: 30 },
  summer: { months: [6, 7, 8], leadTime: 60 },
  fall: { months: [9, 10, 11], leadTime: 45 },
  spring: { months: [3, 4, 5], leadTime: 45 },
  winter: { months: [12, 1, 2], leadTime: 45 },
};

function detectSeasonal(phrase) {
  const phraseLower = phrase.toLowerCase();
  for (const [keyword, data] of Object.entries(SEASONAL_KEYWORDS)) {
    if (phraseLower.includes(keyword)) {
      return {
        seasonal: true,
        season: keyword,
        leadTime: data.leadTime,
        months: data.months,
      };
    }
  }
  return { seasonal: false };
}

// ==========================
// Data Storage
// ==========================
async function storeKeywordData(keywordData) {
  const today = new Date().toISOString().split("T")[0];
  let stored = 0;

  for (const [phrase, data] of keywordData.entries()) {
    try {
      const seasonalInfo = detectSeasonal(phrase);

      // Upsert keyword
      const { error: kwError } = await db.rpc("lexy_upsert_keyword", {
        p_term: phrase,
        p_market: "us",
        p_source: "pinterest",
        p_tier: 0,
        p_method: "social_extract",
        p_extras: {
          pinterest: true,
          save_count: data.saveCount,
          engagement_sum: data.engagement,
          sentiment: data.sentiment,
          board_count: data.boards.size,
          top_pins: data.pins,
          seasonal: seasonalInfo,
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
        .eq("term_normalized", phrase.toLowerCase().trim())
        .eq("source", "pinterest")
        .limit(1);

      if (!keywords || keywords.length === 0) continue;
      const keywordId = keywords[0].id;

      // Store social metrics
      await db.from("keyword_metrics_daily").upsert(
        {
          keyword_id: keywordId,
          collected_on: today,
          source: "pinterest",
          social_mentions: data.count,
          social_sentiment: data.sentiment,
          social_platforms: { pinterest: data.count },
          extras: {
            save_count: data.saveCount,
            engagement_sum: data.engagement,
            board_count: data.boards.size,
            boards: Array.from(data.boards).slice(0, 10),
            top_pins: data.pins,
            seasonal: seasonalInfo,
          },
        },
        { onConflict: "keyword_id,collected_on,source" }
      );

      // Store platform trend
      await db.from("social_platform_trends").insert({
        keyword_id: keywordId,
        platform: "pinterest",
        mention_count: data.count,
        engagement_score: data.engagement,
        sentiment: data.sentiment,
        top_posts: data.pins,
        metadata: {
          board_count: data.boards.size,
          save_count: data.saveCount,
          seasonal: seasonalInfo,
        },
      });

      // Write trend series
      await db.from("trend_series").upsert(
        {
          term: phrase,
          source: "pinterest",
          recorded_on: today,
          trend_score: data.engagement,
          extras: { seasonal: seasonalInfo },
        },
        { onConflict: "term,source,recorded_on" }
      );

      stored++;
    } catch (err) {
      console.warn("store_error:%s:%s", phrase, err?.message || err);
    }
  }

  return stored;
}

// ==========================
// Rate Limit Checking
// ==========================
async function checkRateLimit() {
  const currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Pinterest limits are per-day, not per-month
  const { data } = await db
    .from("api_usage_tracking")
    .select("requests_made, limit_per_period, last_reset_at")
    .eq("service", "pinterest")
    .eq("period", currentDay)
    .maybeSingle();

  if (!data) {
    // Create new tracking record for today
    await db.from("api_usage_tracking").insert({
      service: "pinterest",
      period: currentDay,
      requests_made: 0,
      limit_per_period: DAILY_LIMIT,
      last_reset_at: new Date().toISOString(),
    });
    return PER_RUN_BUDGET;
  }

  const used = data.requests_made || 0;
  const limit = data.limit_per_period || DAILY_LIMIT;
  const remaining = Math.max(0, limit - used);

  console.log("pinterest_usage:%d/%d (%.1f%%)", used, limit, (used / limit) * 100);

  if (remaining < PER_RUN_BUDGET) {
    console.warn("pinterest_quota_low:remaining=%d budget=%d", remaining, PER_RUN_BUDGET);
    return Math.min(remaining, 5);
  }

  return PER_RUN_BUDGET;
}

// ==========================
// Main Collection Logic
// ==========================
async function collectFromUserBoards(budget) {
  const keywordData = new Map();
  let pinsProcessed = 0;
  let remainingBudget = budget;
  let apiCallsMade = 0;

  // Get user's boards (1 API call)
  console.log("collecting:fetching user boards");
  const boards = await getUserBoards();
  remainingBudget -= 1;
  apiCallsMade += 1;

  if (boards.length === 0) {
    console.warn("no_boards_found:user may not have any boards");
    return { keywordData, pinsProcessed, apiCallsMade };
  }

  console.log("found_boards:%d", boards.length);

  // Iterate through boards and collect pins
  for (const board of boards) {
    if (remainingBudget <= 0) break;

    const pinsPerBoard = Math.min(Math.floor(remainingBudget / boards.length), 25);

    try {
      console.log("collecting:board=%s limit=%d", board.name, pinsPerBoard);
      const pins = await getBoardPins(board.id, pinsPerBoard);
      apiCallsMade += 1;

      for (const pin of pins) {
        // Pinterest engagement: saves (strongest intent) + comments + reactions
        const saves = pin.pin_metrics?.save || 0;
        if (saves < MIN_SAVES) continue;

        const engagement =
          saves * 3 + // Saves = strong purchase intent
          (pin.pin_metrics?.comment || 0) * 2 +
          (pin.pin_metrics?.reaction || 0);

        const phrases = extractPhrases(pin.title, pin.description);
        const sentiment = analyzeSentiment((pin.title || "") + " " + (pin.description || ""));

        for (const phrase of phrases) {
          const current = keywordData.get(phrase) || {
            count: 0,
            saveCount: 0,
            engagement: 0,
            sentiment: 0,
            sentimentCount: 0,
            boards: new Set(),
            pins: [],
          };

          current.count++;
          current.saveCount += saves;
          current.engagement += engagement;
          current.sentiment += sentiment;
          current.sentimentCount++;

          if (board.name) {
            current.boards.add(board.name);
          }

          if (current.pins.length < 5) {
            current.pins.push({
              id: pin.id,
              url: pin.link || `https://pinterest.com/pin/${pin.id}`,
              title: pin.title || "",
              saves: saves,
              image: pin.media?.images?.["400x300"]?.url,
            });
          }

          keywordData.set(phrase, current);
        }

        pinsProcessed++;
      }

      remainingBudget -= 1; // Each board pins fetch = 1 API call
    } catch (err) {
      console.error("board_error:%s:%s", board.name, err?.message || err);
    }
  }

  return { keywordData, pinsProcessed, apiCallsMade };
}

// ==========================
// Main
// ==========================
async function main() {
  console.log("pinterest_collector:start");

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await db
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "pinterest_collection")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("pinterest_collection:disabled by feature flag");
      return;
    }

    // Check rate limit
    const budget = await checkRateLimit();
    if (budget <= 0) {
      console.warn("pinterest_quota:exhausted for today");
      return;
    }

    console.log("pinterest_budget:%d API calls", budget);

    // Collect from user's boards (works with basic Pinterest API permissions)
    const { keywordData, pinsProcessed, apiCallsMade } = await collectFromUserBoards(budget);

    console.log("pins_processed:%d keywords_extracted:%d", pinsProcessed, keywordData.size);

    // Calculate average sentiment for each keyword
    for (const [phrase, data] of keywordData.entries()) {
      data.sentiment = data.sentimentCount > 0
        ? Number((data.sentiment / data.sentimentCount).toFixed(2))
        : 0;
    }

    // Store data
    const stored = await storeKeywordData(keywordData);
    console.log("keywords_stored:%d", stored);

    // Track API usage
    console.log("api_calls_made:%d", apiCallsMade);
    await db.rpc("track_api_usage", {
      p_service: "pinterest",
      p_requests: apiCallsMade,
    });

    console.log("pinterest_collector:success");
  } catch (err) {
    console.error("pinterest_collector:error", err?.message || err);
    process.exit(1);
  }
}

main();
