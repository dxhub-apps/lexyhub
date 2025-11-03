// scripts/reddit-keyword-discovery.mjs
// Long-tail Reddit keyword discovery with strong sanitization to avoid URL/HTML artifacts.
// N-grams, 30-day window, recency decay, question/advice prioritization, optional top-comments mining.
// Node 20+

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// ==========================
// Env
// ==========================
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  console.error(
    "Got SUPABASE_URL=%s, SUPABASE_SERVICE_ROLE_KEY length=%s",
    SUPABASE_URL ? "[set]" : "[empty]",
    SUPABASE_SERVICE_ROLE_KEY ? String(SUPABASE_SERVICE_ROLE_KEY.length) : "[empty]"
  );
  process.exit(2);
}

// Modes: "accounts" uses tokens from DB. "anon" uses REDDIT_ACCESS_TOKEN.
const MODE = (process.env.INPUT_MODE || "accounts").toLowerCase(); // accounts | anon
const CONFIG_PATH = process.env.INPUT_CONFIG_PATH || "config/reddit.yml";

// N-gram and scoring controls
const NGRAM_MIN = Number(process.env.INPUT_NGRAM_MIN || 2);
const NGRAM_MAX = Number(process.env.INPUT_NGRAM_MAX || 5);
const MIN_COUNT = Number(process.env.INPUT_MIN_COUNT || 3); // keep phrases with >= MIN_COUNT samples in the window
const MAX_PHRASES_PER_POST = Number(process.env.INPUT_MAX_PHRASES_PER_POST || 300);
const COMMENT_WEIGHT = Number(process.env.INPUT_COMMENT_WEIGHT || 0.5); // comments weight in engagement
const TITLE_BONUS = Number(process.env.INPUT_TITLE_BONUS || 1.25);      // boost if phrase in title
const WINDOW_DAYS = Number(process.env.INPUT_WINDOW_DAYS || 30);        // sliding window
const QUESTION_BONUS = Number(process.env.INPUT_QUESTION_BONUS || 1.2); // boost for question/advice threads
const RECENCY_HALF_LIFE_DAYS = Number(process.env.INPUT_RECENCY_HALF_LIFE_DAYS || 30); // exponential decay
const INCLUDE_COMMENTS = String(process.env.INPUT_INCLUDE_COMMENTS || "").toLowerCase() === "true";

// Intent boosters (retain/boost long-tail commercial intent)
const INTENT_BOOSTERS = new Set([
  "best","cheap","cheapest","custom","personalized","for","gift","gifts","ideas","how to","guide","tutorial",
  "template","printable","size","sizing","pricing","price","cost","compare","vs","versus","tools","software",
  "ai","seo","keywords","listing","listings","mockup","mockups","etsy","amazon","shopify","trend","trending",
  "2025","beginner","starter","pros","cons","materials","kit","bundle"
]);

// Hard filters against tech/URL junk
const BAD_TOKENS = new Set([
  "http","https","www","com","net","org","html","htm","css","js","json","xml","cdn","reddit","redd","preview",
  "jpg","jpeg","png","webp","gif","pjpg","svg","mp4","mov","pdf","amp","utm","ref","width","height","format",
  "id","uid","cid","token","api","app","cache","blob","vercel","storage","aws","s3","cloudfront"
]);
const FILE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|svg|bmp|tif|tiff|mp4|mov|pdf)(\?|$)/i;
const URL_RE = /https?:\/\/\S+/gi;
const HEX_RE = /^[0-9a-f]{6,}$/i;
const TECHY_RE = /^(amp|webp|pjpg|png|jpg|jpeg|gif|pdf|api|cdn|cache|blob|token|width|height)$/i;

// Domain terms that must appear at least once in a kept phrase
const DOMAIN_TERMS = new Set([
  "etsy","seller","sellers","listing","listings","seo","keyword","keywords","shipping","label","labels","dispatch",
  "refund","returns","chargeback","mockup","mockups","digital","print","prints","svg","dxf","stl","template",
  "templates","pricing","price","cost","fees","ad","ads","advertising","campaign","conversion","traffic","orders",
  "sales","bundle","personalized","custom","engraving","niche","product","sku","inventory","fulfillment","pod",
  "printify","printful","gelato","aov","coupon","promotion","shop","shopify","buyer","customer","order",
]);

// ==========================
// Inputs
// ==========================
function splitList(s = "") {
  return String(s)
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function loadYaml(path) {
  if (!fs.existsSync(path)) return { subreddits: [], queries: [] };
  const text = fs.readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  const out = { subreddits: [], queries: [] };
  let current = null;
  for (const line of lines) {
    if (/^\s*subreddits\s*:/.test(line)) current = "subreddits";
    else if (/^\s*queries\s*:/.test(line)) current = "queries";
    else {
      const m = line.match(/^\s*-\s*(.+)$/);
      if (m && current) out[current].push(m[1].trim());
    }
  }
  return out;
}

const cfg = loadYaml(CONFIG_PATH);
const SUBREDDITS = new Set([
  ...splitList(process.env.INPUT_SUBREDDITS),
  ...cfg.subreddits,
]);
const QUERIES = new Set([
  ...splitList(process.env.INPUT_QUERIES),
  ...cfg.queries,
]);

console.log("mode=%s", MODE);
console.log("subreddits=%d queries=%d", SUBREDDITS.size, QUERIES.size);

// ==========================
// Supabase
// ==========================
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ==========================
// Retry helper
// ==========================
async function withRetry(fn, label, { tries = 5, baseMs = 800 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = (e?.message || String(e));
      const retryable = /timeout|fetch|ECONN|ENOTFOUND|5\d\d|Bad gateway|<!DOCTYPE html>|rate_limited/i.test(msg);
      if (!retryable || i === tries) {
        throw new Error(`${label}:${msg}`);
      }
      const wait = Math.round(baseMs * i + Math.random() * 300);
      console.warn("%s:retry %d/%d in %dms :: %s", label, i, tries, wait, msg.slice(0, 200));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

// ==========================
// Reddit helpers
// ==========================
async function redditGET(path, params, token) {
  const qs = new URLSearchParams(params || {}).toString();
  const url = `https://oauth.reddit.com${path}${qs ? "?" + qs : ""}`;
  const r = await fetch(url, {
    headers: { Authorization: `bearer ${token}`, "User-Agent": "lexyhub/1.0 by lexyhub" },
  });
  if (r.status === 429) {
    const reset = Number(r.headers.get("x-ratelimit-reset") || "10");
    throw new Error(`rate_limited:${reset}`);
  }
  if (!r.ok) throw new Error(`reddit_${r.status}:${await r.text()}`);
  return r.json();
}

async function refreshToken(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString();
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "User-Agent": "lexyhub/1.0 by lexyhub",
    },
    body,
  });
  if (!r.ok) throw new Error(`refresh_failed:${r.status}:${await r.text()}`);
  return r.json(); // { access_token, expires_in, ... }
}

// ==========================
// DB writers with retries
// ==========================
async function saveRawPost(post) {
  const d = post.data;
  await withRetry(
    async () => {
      const { error } = await db
        .from("raw_sources")
        .upsert(
          {
            provider: "reddit",
            source_type: "post",
            source_key: d.name ?? null, // t3_*
            status: "processed",
            payload: post,
            metadata: {
              subreddit: d.subreddit,
              score: d.score,
              num_comments: d.num_comments,
              created_utc: d.created_utc,
              permalink: d.permalink,
              title: d.title,
            },
          },
          {
            onConflict: "provider,source_type,source_key",
            ignoreDuplicates: true,
          }
        );
      if (error) throw error;
    },
    "db_raw_sources"
  );
}

// ==========================
// Text sanitization and n-grams
// ==========================
const STOP = new Set([
  "the","a","an","and","or","but","to","for","of","in","on","at","with","by","from","as",
  "is","are","be","was","were","am","i","you","we","they","he","she","it","this","that",
  "how","what","when","where","why","which","who","whom","do","does","did","can","could",
  "should","would","will","may","might","your","my","our","their","his","her"
]);

function sanitizeText(text) {
  if (!text) return "";
  let t = text.replace(URL_RE, " ");                 // drop URLs
  t = t.replace(/&amp;/gi, " ");                     // common HTML entity noise
  t = t.replace(/&[a-z]+;/gi, " ");                  // other entities
  t = t.replace(/[`*_~>|#=\[\]\(\)\{\}\\]/g, " ");   // markdown-ish
  t = t.replace(/[^\w\s-]/g, " ");                   // symbols
  return t;
}
function tokenize(text) {
  const t = sanitizeText(text).toLowerCase();
  return t
    .split(/\s+/)
    .filter((w) => {
      if (!w) return false;
      if (w.length > 40) return false;
      if (BAD_TOKENS.has(w)) return false;
      if (TECHY_RE.test(w)) return false;
      if (HEX_RE.test(w)) return false;
      if (/^\d+$/.test(w)) return false;
      if (/^[a-z][a-z-]*[0-9][a-z-]*$/.test(w)) return false; // alpha+digits junk
      if (FILE_EXT_RE.test(w)) return false;
      return /^[a-z][a-z-]*$/.test(w); // words only
    });
}
function trimStopEdges(words) {
  let i = 0, j = words.length - 1;
  while (i <= j && STOP.has(words[i])) i++;
  while (j >= i && STOP.has(words[j])) j--;
  return words.slice(i, j + 1);
}
function containsDomainTerm(words) {
  for (const w of words) if (DOMAIN_TERMS.has(w)) return true;
  return false;
}
function extractPhrases(title, selftext = "", { minN = NGRAM_MIN, maxN = NGRAM_MAX, maxPhrases = MAX_PHRASES_PER_POST } = {}) {
  const toksTitle = tokenize(title || "");
  const toksBody = tokenize(selftext || "");
  const toks = [...toksTitle, ...toksBody];

  const out = new Map(); // phrase -> { inTitle: boolean }
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i + n <= toksTitle.length; i++) {
      const win0 = toksTitle.slice(i, i + n);
      const win = trimStopEdges(win0);
      if (win.length < minN) continue;
      if (!containsDomainTerm(win)) continue;    // require domain term
      if (win.some((w) => BAD_TOKENS.has(w))) continue;
      const phrase = win.join(" ");
      if (phrase.length < 8) continue;
      out.set(phrase, { inTitle: true });
      if (out.size >= maxPhrases) return out;
    }
    for (let i = 0; i + n <= toks.length; i++) {
      const win0 = toks.slice(i, i + n);
      const win = trimStopEdges(win0);
      if (win.length < minN) continue;
      if (!containsDomainTerm(win)) continue;
      if (win.some((w) => BAD_TOKENS.has(w))) continue;
      const phrase = win.join(" ");
      if (phrase.length < 8) continue;
      if (!out.has(phrase)) out.set(phrase, { inTitle: false });
      if (out.size >= maxPhrases) return out;
    }
  }
  return out;
}

// ==========================
// Phrase aggregation (30-day window)
// key -> { count, scoreSum, lastISO, intentBoost, titleHitCount, samplePosts }
// ==========================
const PHRASE_AGG = new Map();

function withinWindow(iso) {
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs <= WINDOW_DAYS * 864e5;
}
function recencyWeight(iso) {
  const ageDays = Math.max(0, (Date.now() - new Date(iso).getTime()) / 864e5);
  const lambda = Math.log(2) / RECENCY_HALF_LIFE_DAYS; // half-life
  return Math.exp(-lambda * ageDays);
}

function addPhraseSample(phrase, baseScore, recordedISO, inTitle, isQuestionLike, postRef) {
  if (!withinWindow(recordedISO)) return;
  const cur =
    PHRASE_AGG.get(phrase) ||
    {
      count: 0,
      scoreSum: 0,
      lastISO: recordedISO,
      intentBoost: 1,
      titleHitCount: 0,
      samplePosts: [], // keep up to 5 refs for traceability
    };

  cur.count += 1;

  const qBoost = isQuestionLike ? QUESTION_BONUS : 1;
  const rBoost = recencyWeight(recordedISO);
  cur.scoreSum += Math.max(0, baseScore || 0) * (inTitle ? TITLE_BONUS : 1) * qBoost * rBoost;

  if (!cur.lastISO || recordedISO > cur.lastISO) cur.lastISO = recordedISO;
  if (inTitle) cur.titleHitCount += 1;

  for (const token of INTENT_BOOSTERS) {
    if (phrase.includes(token)) {
      cur.intentBoost = Math.max(cur.intentBoost, 1.1);
      break;
    }
  }

  if (postRef && cur.samplePosts.length < 5) {
    cur.samplePosts.push(postRef); // { key, subreddit, permalink, createdISO }
  }

  PHRASE_AGG.set(phrase, cur);
}

async function upsertKeyword(term, method = "ngram_extract", extras = {}) {
  await withRetry(
    async () => {
      const { error } = await db.from("keywords").upsert(
        {
          term,
          source: "reddit",
          market: "us",
          is_seed: false,
          ingest_source: "reddit",
          ingest_metadata: extras, // contains samplePosts and stats
          method,
          allow_search_sampling: true,
        },
        { onConflict: "term,source,market" }
      );
      if (error) throw error;
    },
    "db_keywords"
  );
}

async function writeTrend(term, score, recordedOnISO) {
  const day = recordedOnISO.slice(0, 10);
  await withRetry(
    async () => {
      const { error } = await db.from("trend_series").upsert(
        { term, source: "reddit", recorded_on: day, trend_score: score, extras: {} },
        { onConflict: "term,source,recorded_on" }
      );
      if (error) throw error;
    },
    "db_trend_series"
  );
}

// ==========================
// Processing
// ==========================
async function processPost(post, token) {
  const d = post.data;
  await saveRawPost(post);

  const createdISO = new Date((d.created_utc || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const phrases = extractPhrases(d.title || "", d.selftext || "");
  const engagement = (d.score || 0) + COMMENT_WEIGHT * (d.num_comments || 0);
  const isQuestionLike =
    /\?/.test(d.title || "") ||
    /^(how|what|which|why|where|when|should|could|can|advice|help)\b/i.test(d.title || "");

  const postRef = {
    key: d.name || null, // t3_*
    subreddit: d.subreddit || null,
    permalink: d.permalink || null,
    createdISO,
  };

  for (const [phrase, meta] of phrases.entries()) {
    addPhraseSample(phrase, engagement, createdISO, meta.inTitle, isQuestionLike, postRef);
  }

  if (INCLUDE_COMMENTS) {
    try {
      // Fetch top-level comments for extra long-tail phrases
      const json = await redditGET(`/comments/${d.id}`, { limit: 50, depth: 1, sort: "top" }, token);
      const comments = Array.isArray(json) ? json.at(-1)?.data?.children || [] : [];
      for (const c of comments) {
        const body = c?.data?.body || "";
        if (!body) continue;
        const cISO = new Date(((c.data?.created_utc) || (d.created_utc)) * 1000).toISOString();
        const cPhrases = extractPhrases("", body);
        const cEng = (c.data?.score || 0); // only comment score
        const qBody = /\?/.test(body) || /^(how|what|which|why|where|when|should|could|can|advice|help)\b/i.test(body);
        for (const [phrase] of cPhrases.entries()) {
          addPhraseSample(phrase, cEng, cISO, false, qBody, postRef);
        }
      }
    } catch (e) {
      console.warn("comments_fetch_warn:%s", e?.message || e);
    }
  }
}

async function flushAggregates() {
  let kept = 0;
  for (const [phrase, agg] of PHRASE_AGG.entries()) {
    if (agg.count < MIN_COUNT) continue;

    // Composite score: log(freq) × log(engagement) × intent × small title factor
    const score =
      Math.log1p(agg.count) *
      Math.log1p(agg.scoreSum + 1) *
      (agg.intentBoost || 1) *
      (1 + 0.05 * agg.titleHitCount);

    const extras = {
      ngram: true,
      window_days: WINDOW_DAYS,
      run_count: agg.count,
      engagement_sum: Number(agg.scoreSum.toFixed(3)),
      title_hit_count: agg.titleHitCount,
      intent_boost: agg.intentBoost,
      last_seen_iso: agg.lastISO,
      sample_posts: agg.samplePosts, // up to 5 refs for traceability
    };

    await upsertKeyword(phrase, "ngram_extract", extras);
    await writeTrend(phrase, Number(score.toFixed(6)), agg.lastISO);
    kept++;
  }
  console.log("aggregates_kept=%d min_count=%d total_seen=%d", kept, MIN_COUNT, PHRASE_AGG.size);
}

// ==========================
// Runners
// ==========================
async function runWithToken(token) {
  let processedPosts = 0;

  const subs = SUBREDDITS.size ? [...SUBREDDITS] : ["EtsySellers", "Etsy"];
  for (const sub of subs) {
    const data = await redditGET(`/r/${sub}/new`, { limit: 50 }, token);
    for (const c of data.data.children) {
      await processPost(c, token);
      processedPosts++;
    }
  }

  const queries = [...QUERIES];
  for (const q of queries) {
    const data = await redditGET(`/search`, { q, sort: "new", limit: 50, type: "link" }, token);
    for (const c of data.data.children) {
      await processPost(c, token);
      processedPosts++;
    }
  }

  await flushAggregates();
  console.log("processed_posts=%d", processedPosts);
}

async function runAccounts() {
  const { data: accounts, error } = await db
    .from("marketplace_accounts")
    .select("id,access_token,refresh_token,token_expires_at")
    .eq("provider_id", "reddit")
    .eq("status", "active");
  if (error) throw new Error(`db_accounts:${error.message}`);

  if (!accounts || accounts.length === 0) {
    if (process.env.REDDIT_ACCESS_TOKEN) {
      console.warn("no_accounts: falling back to anon mode");
      return runAnon();
    }
    throw new Error("no_accounts_and_no_token");
  }

  for (const acc of accounts) {
    let token = acc.access_token;
    const exp = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
    if (acc.refresh_token && exp && Date.now() > exp - 60000) {
      const cid = process.env.REDDIT_CLIENT_ID;
      const cs = process.env.REDDIT_CLIENT_SECRET;
      if (cid && cs) {
        try {
          const rt = await refreshToken(acc.refresh_token, cid, cs);
          token = rt.access_token;
          const nextExp = new Date(Date.now() + (rt.expires_in || 3600) * 1000).toISOString();
          const { error: up } = await db
            .from("marketplace_accounts")
            .update({ access_token: token, token_expires_at: nextExp })
            .eq("id", acc.id);
          if (up) console.warn("db_accounts_update:%s", up.message);
        } catch (e) {
          console.error("refresh_failed:%s", e?.message || e);
          continue;
        }
      }
    }
    if (!token) continue;
    await runWithToken(token);
  }
}

async function runAnon() {
  const token = process.env.REDDIT_ACCESS_TOKEN;
  if (!token) {
    console.error("Missing REDDIT_ACCESS_TOKEN for mode=anon");
    process.exit(3);
  }
  await runWithToken(token);
}

// ==========================
// Main
// ==========================
(async function main() {
  try {
    if (MODE === "accounts") await runAccounts();
    else await runAnon();
    console.log("reddit_discovery:ok");
  } catch (e) {
    console.error("reddit_discovery:error", e?.message || e);
    process.exit(1);
  }
})();
