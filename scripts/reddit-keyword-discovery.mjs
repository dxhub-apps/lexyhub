import fetch from "node-fetch";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = process.env.REDDIT_ACCESS_TOKEN; // optional bootstrap; preferred is per-user tokens from DB
const SUBREDDITS = (process.env.SUBREDDITS || "EtsySellers,Etsy").split(",");
const QUERIES = (process.env.QUERIES || "").split(",").filter(Boolean);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function redditGET(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://oauth.reddit.com${path}${qs ? "?" + qs : ""}`;
  const r = await fetch(url, {
    headers: { Authorization: `bearer ${ACCESS_TOKEN}`, "User-Agent": "lexyhub/1.0 by lexyhub" },
  });
  if (r.status === 429) throw new Error("rate_limited");
  if (!r.ok) throw new Error(`reddit_${r.status}:${await r.text()}`);
  return r.json();
}

async function saveRaw(post) {
  const sourceKey = post.data.name; // fullname
  await db.from("raw_sources").upsert({
    provider: "reddit",
    source_type: "post",
    source_key: sourceKey,
    status: "processed",
    payload: post,
    metadata: {
      subreddit: post.data.subreddit,
      score: post.data.score,
      created_utc: post.data.created_utc,
      permalink: post.data.permalink,
      title: post.data.title,
    },
  }, { onConflict: "id" }); // harmless; PK is gen, use provider/type/key index for dedupe reads
  return sourceKey;
}

function extractTerms(title, selftext = "") {
  const text = `${title} ${selftext}`.toLowerCase();
  // trivial baseline; replace with your existing NLP
  return Array.from(new Set(
    text
      .replace(/[^a-z0-9\s\-]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && w.length <= 32)
  )).slice(0, 50);
}

async function upsertKeyword(term, rawSourceId = null) {
  await db.from("keywords").upsert({
    term,
    source: "reddit",
    market: "us",
    is_seed: false,
    ingest_source: "reddit",
    ingest_metadata: {},
    raw_source_id: rawSourceId,
    method: "search",
  }, { onConflict: "term,source,market" }); // add a unique index in DB if you want this fast
}

async function writeTrend(term, score) {
  const today = new Date().toISOString().slice(0,10);
  await db.from("trend_series").upsert({
    term, source: "reddit", recorded_on: today,
    trend_score: score, velocity: null, extras: {},
  }, { onConflict: "term,source,recorded_on" });
}

async function run() {
  for (const sub of SUBREDDITS) {
    const data = await redditGET(`/r/${sub}/new`, { limit: 50 });
    for (const post of data.data.children) {
      const sourceKey = await saveRaw(post);
      const terms = extractTerms(post.data.title, post.data.selftext || "");
      for (const t of terms) {
        await upsertKeyword(t, null);
        await db.from("keyword_events").insert({
          keyword_id: null, // optional: resolve after keyword insert if you enforce it
          listing_id: null,
          raw_source_id: null,
          event_type: "reddit_mention",
          payload: { permalink: post.data.permalink, subreddit: sub, score: post.data.score, title: post.data.title },
        });
        await writeTrend(t, post.data.score);
      }
    }
  }
  if (QUERIES.length) {
    for (const q of QUERIES) {
      const data = await redditGET(`/search`, { q, sort: "new", limit: 50, type: "link" });
      for (const post of data.data.children) {
        const sourceKey = await saveRaw(post);
        const terms = extractTerms(post.data.title, post.data.selftext || "");
        for (const t of terms) {
          await upsertKeyword(t, null);
          await writeTrend(t, post.data.score);
        }
      }
    }
  }
}
run().catch(e => { console.error(e); process.exit(1); });
