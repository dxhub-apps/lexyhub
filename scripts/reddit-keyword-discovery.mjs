// scripts/reddit-keyword-discovery.mjs
// Minimal Reddit discovery using Node 20 global fetch. No extra deps.

import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

// --- Config and inputs ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}
const MODE = (process.env.INPUT_MODE || "accounts").toLowerCase(); // "accounts" | "anon"
const CONFIG_PATH = process.env.INPUT_CONFIG_PATH || "config/reddit.yml";

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
const SUBREDDITS = new Set([...splitList(process.env.INPUT_SUBREDDITS), ...cfg.subreddits]);
const QUERIES = new Set([...splitList(process.env.INPUT_QUERIES), ...cfg.queries]);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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

async function saveRawPost(post) {
  const d = post.data;
  const { error } = await db.from("raw_sources").insert({
    provider: "reddit",
    source_type: "post",
    source_key: d.name, // t3_...
    status: "processed",
    payload: post,
    metadata: {
      subreddit: d.subreddit,
      score: d.score,
      created_utc: d.created_utc,
      permalink: d.permalink,
      title: d.title,
    },
  });
  if (error) throw new Error(`db_raw_sources:${error.message}`);
}

function extractTerms(title, selftext = "") {
  const text = `${title} ${selftext}`.toLowerCase();
  return Array.from(
    new Set(
      text
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && w.length <= 32)
    )
  ).slice(0, 50);
}

async function upsertKeyword(term) {
  const { error } = await db.from("keywords").upsert(
    {
      term,
      source: "reddit",
      market: "us",
      is_seed: false,
      ingest_source: "reddit",
      ingest_metadata: {},
      method: "search",
      allow_search_sampling: true,
    },
    { onConflict: "term,source,market" } // requires a unique index if you want strict dedupe
  );
  if (error) throw new Error(`db_keywords:${error.message}`);
}

async function writeTrend(term, score, recordedOnISO) {
  const day = recordedOnISO.slice(0, 10);
  const { error } = await db.from("trend_series").upsert(
    { term, source: "reddit", recorded_on: day, trend_score: score, extras: {} },
    { onConflict: "term,source,recorded_on" }
  );
  if (error) throw new Error(`db_trend_series:${error.message}`);
}

async function processPost(post) {
  const d = post.data;
  await saveRawPost(post);
  const terms = extractTerms(d.title, d.selftext || "");
  const dayISO = new Date((d.created_utc || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  for (const t of terms) {
    await upsertKeyword(t);
    await writeTrend(t, d.score || 0, dayISO);
  }
}

async function runWithToken(token) {
  const subs = SUBREDDITS.size ? [...SUBREDDITS] : ["EtsySellers", "Etsy"];
  for (const sub of subs) {
    const data = await redditGET(`/r/${sub}/new`, { limit: 50 }, token);
    for (const c of data.data.children) await processPost(c);
  }
  const queries = [...QUERIES];
  for (const q of queries) {
    const data = await redditGET(`/search`, { q, sort: "new", limit: 50, type: "link" }, token);
    for (const c of data.data.children) await processPost(c);
  }
}

async function runAccounts() {
  const { data: accounts, error } = await db
    .from("marketplace_accounts")
    .select("id,access_token,refresh_token,token_expires_at")
    .eq("provider_id", "reddit")
    .eq("status", "active");
  if (error) throw new Error(`db_accounts:${error.message}`);

  for (const acc of accounts || []) {
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
          await db.from("marketplace_accounts").update({
            access_token: token,
            token_expires_at: nextExp,
          }).eq("id", acc.id);
        } catch (e) {
          console.error("refresh_failed", e?.message || e);
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
