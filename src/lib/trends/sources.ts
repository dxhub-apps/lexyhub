import { Buffer } from "node:buffer";

import type { TrendSignal } from "./types";
import { env } from "../env";

function normalizeScore(score: number, max: number = 100): number {
  if (!Number.isFinite(score) || max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, score / max));
}

function createStubSignals(source: TrendSignal["source"]): TrendSignal[] {
  if (source === "google_trends") {
    return [
      {
        term: "handmade jewelry",
        source,
        score: 82,
        normalizedScore: normalizeScore(82),
        change: 0.18,
        metadata: { region: "US", sample: true },
      },
      {
        term: "eco candles",
        source,
        score: 64,
        normalizedScore: normalizeScore(64),
        change: 0.12,
        metadata: { region: "US", sample: true },
      },
    ];
  }

  if (source === "pinterest") {
    return [
      {
        term: "minimalist wall art",
        source,
        score: 5400,
        normalizedScore: normalizeScore(5400, 6000),
        change: 0.22,
        metadata: { boardSample: true },
      },
      {
        term: "handmade jewelry",
        source,
        score: 4300,
        normalizedScore: normalizeScore(4300, 6000),
        change: 0.17,
        metadata: { boardSample: true },
      },
    ];
  }

  return [
    {
      term: "cottagecore dress",
      source,
      score: 2800,
      normalizedScore: normalizeScore(2800, 3000),
      change: 0.25,
      metadata: { subreddit: "r/EtsySellers", sample: true },
    },
    {
      term: "eco candles",
      source,
      score: 2100,
      normalizedScore: normalizeScore(2100, 3000),
      change: 0.19,
      metadata: { subreddit: "r/DIYcandles", sample: true },
    },
  ];
}

async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Trend source fetch failed for ${url}`, error);
    return null;
  }
}

export async function fetchGoogleTrendsSignals(): Promise<TrendSignal[]> {
  if (!env.GOOGLE_TRENDS_API_KEY) {
    return createStubSignals("google_trends");
  }

  const result = (await fetchJson(
    "https://trends.google.com/api/explore",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.GOOGLE_TRENDS_API_KEY,
      },
    },
  )) as { terms?: Array<{ term: string; score: number; delta: number; region?: string }> } | null;

  if (!result?.terms?.length) {
    return createStubSignals("google_trends");
  }

  return result.terms.map((entry) => ({
    term: entry.term,
    source: "google_trends",
    score: entry.score,
    normalizedScore: normalizeScore(entry.score),
    change: entry.delta ?? 0,
    metadata: { region: entry.region ?? "global" },
  }));
}

export async function fetchPinterestTrendSignals(): Promise<TrendSignal[]> {
  if (!env.PINTEREST_ACCESS_TOKEN) {
    return createStubSignals("pinterest");
  }

  const result = (await fetchJson("https://api.pinterest.com/v5/analytics/trends", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env.PINTEREST_ACCESS_TOKEN}`,
    },
  })) as { trends?: Array<{ term: string; score: number; velocity?: number }> } | null;

  if (!result?.trends?.length) {
    return createStubSignals("pinterest");
  }

  const maxScore = result.trends.reduce((max, trend) => Math.max(max, trend.score ?? 0), 0) || 1;

  return result.trends.map((trend) => ({
    term: trend.term,
    source: "pinterest",
    score: trend.score,
    normalizedScore: normalizeScore(trend.score, maxScore),
    change: trend.velocity ?? 0,
    metadata: { source: "pinterest" },
  }));
}

export async function fetchRedditTrendSignals(): Promise<TrendSignal[]> {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) {
    return createStubSignals("reddit");
  }

  const auth = Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString("base64");
  const tokenPayload = (await fetchJson("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })) as { access_token?: string } | null;

  const token = tokenPayload?.access_token;
  if (!token) {
    return createStubSignals("reddit");
  }

  const result = (await fetchJson("https://oauth.reddit.com/r/EtsySellers/hot", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "lexyhub-trend-intelligence/1.0",
    },
  })) as { data?: { children?: Array<{ data?: { title?: string; score?: number; upvote_ratio?: number } }> } } | null;

  const posts = result?.data?.children ?? [];
  if (!posts.length) {
    return createStubSignals("reddit");
  }

  const maxScore = posts.reduce((max, post) => Math.max(max, post.data?.score ?? 0), 1);

  return posts.slice(0, 10).map((post) => {
    const title = post.data?.title ?? "untitled";
    const score = post.data?.score ?? 0;
    const ratio = post.data?.upvote_ratio ?? 0.5;
    return {
      term: title.toLowerCase(),
      source: "reddit" as const,
      score,
      normalizedScore: normalizeScore(score, maxScore),
      change: Math.max(0, ratio - 0.5),
      metadata: { subreddit: "r/EtsySellers" },
    } satisfies TrendSignal;
  });
}
