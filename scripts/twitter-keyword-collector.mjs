// scripts/twitter-keyword-collector.mjs
// Twitter/X keyword trend collection using API v2 Free Tier
// Limits: 1,500 posts/month read-only
// Node 20+

import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ==========================
// Env
// ==========================
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

if (!TWITTER_BEARER_TOKEN) {
  console.error("Missing TWITTER_BEARER_TOKEN");
  process.exit(2);
}

// Monthly limit tracking
const MONTHLY_LIMIT = Number(process.env.TWITTER_MONTHLY_LIMIT || 100);
const PER_RUN_BUDGET = Number(process.env.TWITTER_PER_RUN_BUDGET || 50); // Default: 50 tweets per run (2 runs/month)

// Tracking configuration
const TRACKING_ACCOUNTS = [
  "EtsySellers",
  "Shopify",
  "ProductHunt",
  "trendingetsy",
  "redbubble",
  "printful",
  "printify",
];

// Reduced to 5 hashtags to fit 100 tweets/month budget (5 × 10 = 50 per run, 2 runs/month)
const TRACKING_HASHTAGS = [
  "#etsyseller",
  "#printondemand",
  "#ecommerce",
  "#smallbusiness",
  "#handmade",
];

const NGRAM_MIN = 2;
const NGRAM_MAX = 5;
const MIN_ENGAGEMENT = 3; // Minimum likes+retweets to consider

// ==========================
// Supabase
// ==========================
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================
// Sentiment Analysis (reuse from Reddit)
// ==========================
const POSITIVE_WORDS = new Set([
  "love","excellent","amazing","best","great","awesome","perfect","fantastic","wonderful","brilliant",
  "outstanding","superb","impressive","good","nice","helpful","recommend","success","profitable",
  "easy","beautiful","quality","top","favorite","glad","thank","thanks","working","win","winning",
  "trending","hot","viral","popular","selling"
]);

const NEGATIVE_WORDS = new Set([
  "bad","worst","terrible","awful","horrible","poor","disappointing","useless","waste","scam",
  "fraud","fake","difficult","hard","confusing","frustrating","problem","issue","broken","fail",
  "failed","failing","sucks","hate","avoid","warning","beware","never","don't","complaint","dead"
]);

const INTENSIFIERS = new Set(["very","extremely","really","super","absolutely","totally","completely"]);

function analyzeSentiment(text) {
  if (!text) return 0;
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  let wordCount = 0;
  let intensifier = 1.0;

  for (const word of words) {
    if (INTENSIFIERS.has(word)) {
      intensifier = 1.5;
      continue;
    }

    if (POSITIVE_WORDS.has(word)) {
      score += (1 * intensifier);
      wordCount++;
      intensifier = 1.0;
    } else if (NEGATIVE_WORDS.has(word)) {
      score -= (1 * intensifier);
      wordCount++;
      intensifier = 1.0;
    }
  }

  if (wordCount === 0) return 0;
  const normalized = score / Math.max(wordCount, 1);
  return Math.max(-1, Math.min(1, normalized));
}

// ==========================
// Twitter API v2 Helpers
// ==========================
async function twitterGET(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.twitter.com/2/${endpoint}${qs ? "?" + qs : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
      "User-Agent": "lexyhub/1.0",
    },
  });

  if (response.status === 429) {
    const resetTime = response.headers.get("x-rate-limit-reset");
    throw new Error(`rate_limited:reset_at:${resetTime}`);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`twitter_error:${response.status}:${text}`);
  }

  return response.json();
}

async function searchRecentTweets(query, maxResults = 10) {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();

  const data = await twitterGET("tweets/search/recent", {
    query,
    max_results: Math.min(maxResults, 100),
    start_time: since,
    "tweet.fields": "created_at,public_metrics,author_id",
    expansions: "author_id",
  });

  return data.data || [];
}

// ==========================
// Text Processing
// ==========================
const DOMAIN_TERMS = new Set([
  "etsy","seller","sellers","listing","listings","shop","product","products","print","prints",
  "design","designer","handmade","custom","personalized","gift","gifts","merch","merchandise",
  "trending","viral","selling","sales","orders","business","brand","niche","idea","ideas"
]);

function sanitizeText(text) {
  if (!text) return "";
  let t = text.replace(/https?:\/\/\S+/g, " "); // Remove URLs
  t = t.replace(/[@#]\w+/g, " "); // Remove mentions and hashtags from text
  t = t.replace(/[^\w\s-]/g, " "); // Remove special chars
  return t;
}

function tokenize(text) {
  const t = sanitizeText(text).toLowerCase();
  return t
    .split(/\s+/)
    .filter((w) => {
      if (!w || w.length > 40) return false;
      if (!/^[a-z][a-z-]*$/.test(w)) return false;
      return true;
    });
}

function extractPhrases(text) {
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
// Data Storage
// ==========================
async function storeKeywordData(keywordData) {
  const today = new Date().toISOString().split("T")[0];
  let stored = 0;

  for (const [phrase, data] of keywordData.entries()) {
    try {
      // Upsert keyword
      const { error: kwError } = await db.rpc("lexy_upsert_keyword", {
        p_term: phrase,
        p_market: "us",
        p_source: "twitter",
        p_tier: 0,
        p_method: "social_extract",
        p_extras: {
          twitter: true,
          mention_count: data.count,
          engagement_sum: data.engagement,
          sentiment: data.sentiment,
          top_tweets: data.tweets,
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
        .eq("source", "twitter")
        .limit(1);

      if (!keywords || keywords.length === 0) continue;
      const keywordId = keywords[0].id;

      // Store social metrics
      await db.from("keyword_metrics_daily").upsert(
        {
          keyword_id: keywordId,
          collected_on: today,
          source: "twitter",
          social_mentions: data.count,
          social_sentiment: data.sentiment,
          social_platforms: { twitter: data.count },
          extras: {
            engagement_sum: data.engagement,
            top_tweets: data.tweets,
          },
        },
        { onConflict: "keyword_id,collected_on,source" }
      );

      // Store platform trend
      await db.from("social_platform_trends").insert({
        keyword_id: keywordId,
        platform: "twitter",
        mention_count: data.count,
        engagement_score: data.engagement,
        sentiment: data.sentiment,
        top_posts: data.tweets,
        metadata: {},
      });

      // Write trend series
      await db.from("trend_series").upsert(
        {
          term: phrase,
          source: "twitter",
          recorded_on: today,
          trend_score: data.engagement,
          extras: {},
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
  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  const { data } = await db
    .from("api_usage_tracking")
    .select("requests_made, limit_per_period")
    .eq("service", "twitter")
    .eq("period", currentPeriod)
    .maybeSingle();

  if (!data) return PER_RUN_BUDGET; // First run of the month

  const used = data.requests_made || 0;
  const limit = data.limit_per_period || MONTHLY_LIMIT;
  const remaining = Math.max(0, limit - used);

  console.log("twitter_usage:%d/%d (%.1f%%)", used, limit, (used / limit) * 100);

  if (remaining < PER_RUN_BUDGET) {
    console.warn("twitter_quota_low:remaining=%d budget=%d", remaining, PER_RUN_BUDGET);
    return Math.min(remaining, 10); // At least try 10 tweets
  }

  return PER_RUN_BUDGET;
}

// ==========================
// Main Collection Logic
// ==========================
async function collectFromHashtags(budget) {
  const keywordData = new Map();
  let tweetsProcessed = 0;
  let remainingBudget = budget;

  for (const hashtag of TRACKING_HASHTAGS) {
    if (remainingBudget <= 0) break;

    // Twitter API requires max_results to be between 10 and 100
    const MIN_TWITTER_RESULTS = 10;
    const MAX_TWITTER_RESULTS = 100;

    const perHashtagLimit = Math.min(
      Math.max(Math.floor(remainingBudget / TRACKING_HASHTAGS.length), MIN_TWITTER_RESULTS),
      MAX_TWITTER_RESULTS
    );

    // Skip if we don't have enough budget for minimum API requirement
    if (remainingBudget < MIN_TWITTER_RESULTS) {
      console.log("skipping:hashtag=%s insufficient_budget=%d", hashtag, remainingBudget);
      break;
    }

    try {
      console.log("collecting:hashtag=%s limit=%d", hashtag, perHashtagLimit);
      const tweets = await searchRecentTweets(hashtag, perHashtagLimit);

      for (const tweet of tweets) {
        const engagement =
          (tweet.public_metrics?.like_count || 0) +
          (tweet.public_metrics?.retweet_count || 0) * 2 +
          (tweet.public_metrics?.reply_count || 0) * 3;

        if (engagement < MIN_ENGAGEMENT) continue;

        const phrases = extractPhrases(tweet.text);
        const sentiment = analyzeSentiment(tweet.text);

        for (const phrase of phrases) {
          const current = keywordData.get(phrase) || {
            count: 0,
            engagement: 0,
            sentiment: 0,
            sentimentCount: 0,
            tweets: [],
          };

          current.count++;
          current.engagement += engagement;
          current.sentiment += sentiment;
          current.sentimentCount++;

          if (current.tweets.length < 5) {
            current.tweets.push({
              id: tweet.id,
              url: `https://twitter.com/i/web/status/${tweet.id}`,
              text: tweet.text.slice(0, 200),
              engagement,
            });
          }

          keywordData.set(phrase, current);
        }

        tweetsProcessed++;
      }

      remainingBudget -= tweets.length;
    } catch (err) {
      console.error("hashtag_error:%s:%s", hashtag, err?.message || err);
    }
  }

  return { keywordData, tweetsProcessed };
}

async function collectFromAccounts(budget) {
  const keywordData = new Map();
  let tweetsProcessed = 0;

  // For accounts, we'd need user timeline endpoint which requires different auth
  // Skipping for now, focus on hashtags for free tier
  console.log("account_tracking:skipped (requires OAuth 2.0)");

  return { keywordData, tweetsProcessed };
}

// ==========================
// Main
// ==========================
async function main() {
  console.log("twitter_collector:start");

  try {
    // Check if feature is enabled
    const { data: featureFlag } = await db
      .from("feature_flags")
      .select("is_enabled")
      .eq("key", "twitter_collection")
      .maybeSingle();

    if (!featureFlag || !featureFlag.is_enabled) {
      console.log("twitter_collection:disabled by feature flag");
      return;
    }

    // Check rate limit
    const budget = await checkRateLimit();
    if (budget <= 0) {
      console.warn("twitter_quota:exhausted for this month");
      return;
    }

    console.log("twitter_budget:%d tweets", budget);

    // Collect from hashtags
    const { keywordData, tweetsProcessed } = await collectFromHashtags(budget);

    console.log("tweets_processed:%d keywords_extracted:%d", tweetsProcessed, keywordData.size);

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
    await db.rpc("track_api_usage", {
      p_service: "twitter",
      p_requests: tweetsProcessed,
    });

    console.log("twitter_collector:success");
  } catch (err) {
    console.error("twitter_collector:error", err?.message || err);
    process.exit(1);
  }
}

main();
