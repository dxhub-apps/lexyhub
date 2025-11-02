#!/usr/bin/env node
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const USER_AGENT =
  process.env.PLAYWRIGHT_USER_AGENT ??
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SEARCH_BASE_URL = "https://www.etsy.com/search";
const SEARCH_SOURCE = "etsy_serp";
const DEFAULT_SAMPLE_LIMIT = 12;
const MAX_HTML_SNAPSHOT_CHARS = 20000;

interface CandidateKeyword {
  id: string;
  term: string;
  market: string;
}

interface SerpListing {
  id: string;
  url: string | null;
  title: string | null;
  tags: string[];
  position: number;
}

interface SerpCapture {
  totalResults: number | null;
  totalResultsText: string | null;
  listings: SerpListing[];
  htmlSnippet: string;
  htmlChecksum: string;
  capturedAt: string;
}

interface RawSerpResult {
  totalText: string | null;
  listings: SerpListing[];
}

interface DerivedMetrics {
  competition: number | null;
  coverage: number;
  tagReuse: number;
  trackedListingCount: number;
  totalListings: number;
}

interface CliOptions {
  keywordId?: string;
  keywordTerm?: string;
  limit: number;
}

function parseCliOptions(): CliOptions {
  const options: CliOptions = { limit: DEFAULT_SAMPLE_LIMIT };
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) {
      options.keywordTerm = arg;
      continue;
    }
    const [flag, rawValue] = arg.split("=", 2);
    const value = rawValue ?? "";
    switch (flag) {
      case "--keyword-id":
      case "--id":
        options.keywordId = value.trim();
        break;
      case "--keyword":
      case "--term":
        options.keywordTerm = value.trim();
        break;
      case "--limit": {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          options.limit = parsed;
        }
        break;
      }
      default:
        break;
    }
  }
  if (Number.isFinite(Number(process.env.SERP_SAMPLE_LIMIT))) {
    const parsed = Number.parseInt(String(process.env.SERP_SAMPLE_LIMIT), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      options.limit = parsed;
    }
  }
  return options;
}

type BrowserCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
};

function parseSetCookieHeader(header: string): BrowserCookie | null {
  if (!header) return null;
  const segments = header
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) {
    return null;
  }
  const [nameValue, ...attributes] = segments;
  const equalsIndex = nameValue.indexOf("=");
  if (equalsIndex <= 0) {
    return null;
  }
  const name = nameValue.slice(0, equalsIndex).trim();
  const value = nameValue.slice(equalsIndex + 1).trim();
  if (!name) {
    return null;
  }
  const cookie: BrowserCookie = {
    name,
    value,
    domain: ".etsy.com",
    path: "/",
  };
  for (const attribute of attributes) {
    if (!attribute) continue;
    if (!attribute.includes("=")) {
      const normalized = attribute.toLowerCase();
      if (normalized === "secure") {
        cookie.secure = true;
      } else if (normalized === "httponly") {
        cookie.httpOnly = true;
      }
      continue;
    }
    const [rawKey, ...rawValueParts] = attribute.split("=");
    const key = rawKey.trim().toLowerCase();
    const rawValue = rawValueParts.join("=").trim();
    if (!key) continue;
    switch (key) {
      case "domain": {
        if (rawValue) {
          const normalizedDomain = rawValue.startsWith(".") ? rawValue : `.${rawValue}`;
          cookie.domain = normalizedDomain;
        }
        break;
      }
      case "path":
        cookie.path = rawValue || "/";
        break;
      case "expires": {
        const timestamp = Date.parse(rawValue);
        if (!Number.isNaN(timestamp)) {
          cookie.expires = Math.floor(timestamp / 1000);
        }
        break;
      }
      case "max-age": {
        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isFinite(parsed)) {
          cookie.expires = Math.floor(Date.now() / 1000) + Math.max(0, parsed);
        }
        break;
      }
      case "samesite": {
        const normalizedValue = rawValue.toLowerCase();
        if (normalizedValue === "lax") {
          cookie.sameSite = "Lax";
        } else if (normalizedValue === "strict") {
          cookie.sameSite = "Strict";
        } else if (normalizedValue === "none") {
          cookie.sameSite = "None";
        }
        break;
      }
      default:
        break;
    }
  }
  return cookie;
}

function parseEnvCookies(envCookie: string | undefined): BrowserCookie[] {
  if (!envCookie) {
    return [];
  }
  const lines = envCookie
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const cookies: BrowserCookie[] = [];
  for (const line of lines) {
    const sanitized = line.replace(/^set-cookie:/i, "").trim();
    const parsed = parseSetCookieHeader(sanitized);
    if (parsed) {
      cookies.push(parsed);
    }
  }
  return cookies;
}

function detectCaptcha(html: string): boolean {
  if (!html) return false;
  const normalized = html.toLowerCase();
  return normalized.includes("captcha-delivery") || normalized.includes("datadome");
}

async function extractSerp(page: any, keyword: CandidateKeyword): Promise<SerpCapture> {
  const searchUrl = `${SEARCH_BASE_URL}?q=${encodeURIComponent(keyword.term)}`;
  let attempt = 0;
  while (attempt < 3) {
    attempt += 1;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const html = await page.content();
    if (detectCaptcha(html)) {
      if (attempt >= 3) {
        throw new Error(`Encountered captcha while loading ${searchUrl}`);
      }
      await delay(1500);
      continue;
    }
    const captureRaw = await page.evaluate(() => {
      const totalResultSelectors = [
        "[data-search-results-count]",
        "[data-search-results] [data-search-results-count]",
        "[data-search-results-count-text]",
        "[data-search-results-container] [aria-live]",
      ];
      let totalText: string | null = null;
      for (const selector of totalResultSelectors) {
        const node = document.querySelector(selector);
        if (node) {
          totalText =
            node.getAttribute("data-search-results-count")?.trim() || node.textContent?.trim() || null;
          if (totalText) break;
        }
      }
      if (!totalText) {
        const heading = document.querySelector("h1, h2");
        const headingText = heading?.textContent ?? "";
        const match = headingText.match(/([\d,.]+)\s+results/i);
        if (match) {
          totalText = match[1];
        }
      }
      const listingNodes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-search-results-container] [data-listing-id]"),
      );
      const listings = listingNodes.map((node, index) => {
        const rawId = node.getAttribute("data-listing-id") ?? "";
        const anchor = node.querySelector<HTMLAnchorElement>('a[href*="/listing/"]');
        const titleNode =
          node.querySelector<HTMLElement>("[data-title]") || anchor?.querySelector<HTMLElement>("[data-title]");
        const title = titleNode?.textContent?.trim() || anchor?.textContent?.trim() || null;
        const tags = Array.from(
          node.querySelectorAll<HTMLElement>("[data-search-result-tags] li, [data-search-result-tags] a"),
        )
          .map((tagNode) => tagNode.textContent?.trim() || "")
          .filter((tag): tag is string => Boolean(tag));
        return {
          id: rawId,
          url: anchor?.href ?? null,
          title,
          tags,
          position: index + 1,
        };
      });
      return { totalText, listings };
    });
    const capture = captureRaw as RawSerpResult;
    const totalResultsText = capture.totalText;
    const numericTotal = totalResultsText ? Number.parseInt(totalResultsText.replace(/[^\d]/g, ""), 10) : null;
    const listings = capture.listings.filter((listing) => Boolean(listing.id));
    if (!listings.length && attempt < 3) {
      await delay(1000);
      continue;
    }
    const truncatedHtml = html.length > MAX_HTML_SNAPSHOT_CHARS ? `${html.slice(0, MAX_HTML_SNAPSHOT_CHARS)}…` : html;
    const checksum = createHash("sha256").update(html).digest("hex");
    return {
      totalResults: Number.isFinite(numericTotal) ? numericTotal : null,
      totalResultsText,
      listings,
      htmlSnippet: truncatedHtml,
      htmlChecksum: checksum,
      capturedAt: new Date().toISOString(),
    };
  }
  throw new Error(`Unable to capture SERP for ${keyword.term}`);
}

function computeDerivedMetrics(
  capture: SerpCapture,
  knownListings: Map<string, string>,
): DerivedMetrics {
  const totalListings = capture.listings.length;
  const trackedListingIds = new Set<string>();
  for (const [, listingId] of knownListings) {
    if (listingId) {
      trackedListingIds.add(listingId);
    }
  }
  const trackedListingCount = trackedListingIds.size;
  const coverage = totalListings > 0 ? trackedListingCount / totalListings : 0;
  let competition: number | null = null;
  if (capture.totalResults != null) {
    competition = Math.max(0, Math.min(1, Math.log1p(capture.totalResults) / Math.log1p(1_000_000)));
  }
  const allTags = capture.listings.flatMap((listing) => listing.tags);
  const uniqueTags = new Set(allTags);
  const tagReuse = allTags.length > 0 ? 1 - uniqueTags.size / allTags.length : 0;
  return {
    competition,
    coverage,
    tagReuse,
    trackedListingCount,
    totalListings,
  };
}

async function mapListingsToInternal(
  supabase: SupabaseClient,
  externalIds: string[],
): Promise<Map<string, string>> {
  if (!externalIds.length) {
    return new Map();
  }
  const uniqueIds = Array.from(new Set(externalIds.map((value) => value.trim()).filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }
  const { data, error } = await supabase
    .from("listings")
    .select("id, external_listing_id")
    .in("external_listing_id", uniqueIds);
  if (error) {
    console.warn("Failed to map external listing IDs", error);
    return new Map();
  }
  const mapping = new Map<string, string>();
  for (const row of data ?? []) {
    if (row?.external_listing_id && row.id) {
      mapping.set(String(row.external_listing_id), String(row.id));
    }
  }
  return mapping;
}

async function fetchCandidateById(
  supabase: SupabaseClient,
  keywordId: string,
): Promise<CandidateKeyword | null> {
  const { data, error } = await supabase
    .from("keywords")
    .select("id, term, market, allow_search_sampling")
    .eq("id", keywordId)
    .maybeSingle();
  if (error) {
    console.error(`Failed to load keyword ${keywordId}`, error);
    return null;
  }
  if (!data) {
    console.warn(`Keyword ${keywordId} was not found.`);
    return null;
  }
  if (!data.allow_search_sampling) {
    console.warn(`Keyword ${keywordId} is not flagged for search sampling. Skipping.`);
    return null;
  }
  return { id: String(data.id), term: String(data.term), market: String(data.market) };
}

async function fetchCandidateByTerm(
  supabase: SupabaseClient,
  term: string,
): Promise<CandidateKeyword | null> {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) {
    return null;
  }
  const { data, error } = await supabase
    .from("keywords")
    .select("id, term, market, allow_search_sampling")
    .ilike("term", normalizedTerm)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`Failed to load keyword term ${term}`, error);
    return null;
  }
  if (!data) {
    console.warn(`No keyword matched term ${term}.`);
    return null;
  }
  if (!data.allow_search_sampling) {
    console.warn(`Keyword ${data.id} matched term ${term} but is not allowed for sampling.`);
    return null;
  }
  return { id: String(data.id), term: String(data.term), market: String(data.market) };
}

async function fetchKeywordCandidates(
  supabase: SupabaseClient,
  options: CliOptions,
): Promise<CandidateKeyword[]> {
  if (options.keywordId) {
    const candidate = await fetchCandidateById(supabase, options.keywordId);
    return candidate ? [candidate] : [];
  }
  if (options.keywordTerm) {
    const candidate = await fetchCandidateByTerm(supabase, options.keywordTerm);
    return candidate ? [candidate] : [];
  }
  const { data, error } = await supabase.rpc("keyword_serp_sampling_candidates", {
    sample_limit: Math.max(1, options.limit),
  });
  if (error) {
    console.error("Failed to load keyword SERP sampling candidates", error);
    return [];
  }
  return (data ?? [])
    .map((row: { keyword_id: string; term: string; market: string }) => ({
      id: String(row.keyword_id),
      term: String(row.term),
      market: String(row.market),
    }))
    .filter((candidate: CandidateKeyword) => candidate.id && candidate.term);
}

async function persistSerpSamples(
  supabase: SupabaseClient,
  candidate: CandidateKeyword,
  capture: SerpCapture,
  metrics: DerivedMetrics,
  knownListings: Map<string, string>,
): Promise<void> {
  const capturedAt = capture.capturedAt;
  const listingsPayload = capture.listings.map((listing) => ({
    keyword_id: candidate.id,
    listing_id: knownListings.get(listing.id) ?? null,
    source: SEARCH_SOURCE,
    position: listing.position,
    url: listing.url,
    title: listing.title,
    tags: listing.tags,
    total_results: capture.totalResults,
    derived_metrics: metrics,
    snapshot: {
      listing: {
        etsyListingId: listing.id,
        tags: listing.tags,
        url: listing.url,
        title: listing.title,
        position: listing.position,
      },
      serp: {
        keyword: { id: candidate.id, term: candidate.term, market: candidate.market },
        totalResults: capture.totalResults,
        totalResultsText: capture.totalResultsText,
        capturedAt,
        htmlChecksum: capture.htmlChecksum,
      },
    },
  }));
  const summaryPayload = {
    keyword_id: candidate.id,
    listing_id: null,
    source: SEARCH_SOURCE,
    position: null,
    url: null,
    title: `SERP summary for ${candidate.term}`,
    tags: [],
    total_results: capture.totalResults,
    derived_metrics: metrics,
    snapshot: {
      keyword: { id: candidate.id, term: candidate.term, market: candidate.market },
      listings: capture.listings,
      metrics,
      totalResults: capture.totalResults,
      totalResultsText: capture.totalResultsText,
      capturedAt,
      htmlChecksum: capture.htmlChecksum,
      htmlSnippet: capture.htmlSnippet,
    },
  };
  const { error } = await supabase.from("keyword_serp_samples").insert([...listingsPayload, summaryPayload]);
  if (error) {
    throw new Error(error.message);
  }
}

async function main(): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new Error(
      "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the sampler.",
    );
  }
  const options = parseCliOptions();
  const candidates = await fetchKeywordCandidates(supabase, options);
  if (!candidates.length) {
    console.log("No eligible keywords found for SERP sampling.");
    return;
  }
  const proxyUrl =
    process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || undefined;
  const browser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    proxy: proxyUrl ? { server: proxyUrl } : undefined,
  });
  const cookies = parseEnvCookies(process.env.ETSY_COOKIE);
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: USER_AGENT,
  });
  if (cookies.length) {
    const addCookies = (context as { addCookies?: (values: BrowserCookie[]) => Promise<void> }).addCookies;
    if (typeof addCookies === "function") {
      await addCookies.call(context, cookies);
      console.info(`Loaded ${cookies.length} cookies into Playwright context.`);
    } else {
      console.warn("Playwright context does not expose addCookies; skipping initial cookie hydration.");
    }
  }
  try {
    for (const candidate of candidates) {
      console.log(`\n▶ Sampling keyword: ${candidate.term} (${candidate.id})`);
      const page = await context.newPage();
      try {
        const capture = await extractSerp(page, candidate);
        if (!capture.listings.length) {
          console.warn(`No listings discovered for ${candidate.term}. Skipping persistence.`);
          continue;
        }
        const mapping = await mapListingsToInternal(
          supabase,
          capture.listings.map((listing) => listing.id),
        );
        const metrics = computeDerivedMetrics(capture, mapping);
        await persistSerpSamples(supabase, candidate, capture, metrics, mapping);
        console.log(
          `Captured ${capture.listings.length} listings for ${candidate.term} (competition: ${
            metrics.competition != null ? metrics.competition.toFixed(3) : "n/a"
          }, coverage: ${metrics.coverage.toFixed(3)}, tag reuse: ${metrics.tagReuse.toFixed(3)})`,
        );
      } catch (error) {
        console.error(`Failed to sample keyword ${candidate.term}:`, error);
      } finally {
        await page.close();
        await delay(750);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Keyword SERP sampler failed", error);
  process.exitCode = 1;
});
