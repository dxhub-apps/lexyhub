#!/usr/bin/env node
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const DEFAULT_QUERIES = ['handmade gifts'];
const DEFAULT_LIMIT = 25;

function normalizeQuery(query) {
  return query.trim().toLowerCase();
}

function sanitizeLimit(rawLimit) {
  const parsed = Number.parseInt(rawLimit, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function parseQueriesFromEnvOrArgs() {
  const fromEnv = process.env.ETSY_QUERIES?.split(',').map((value) => value.trim());
  const fromArgs = process.argv.slice(2);
  const queries = [...(fromEnv ?? []), ...fromArgs].filter(Boolean);
  if (queries.length === 0) {
    return DEFAULT_QUERIES;
  }
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

function buildRequestUrl(query, limit) {
  const url = new URL('https://www.etsy.com/api/etsywill/autocomplete/suggestions');
  url.searchParams.set('search_query', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('include_recent_searches', 'false');
  url.searchParams.set('types', 'queries');
  return url;
}

function pickSuggestionsFromPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload
      .flatMap((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }
        if (entry && typeof entry === 'object') {
          return entry.query ?? entry.term ?? entry.text ?? entry.value ?? [];
        }
        return [];
      })
      .filter((item) => typeof item === 'string');
  }

  if (Array.isArray(payload?.suggestions)) {
    return payload.suggestions
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          return item.display_name ?? item.query ?? item.term ?? item.text ?? item.value ?? null;
        }
        return null;
      })
      .filter((item) => typeof item === 'string');
  }

  if (Array.isArray(payload?.data?.suggestions)) {
    return payload.data.suggestions
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          return item.display_name ?? item.query ?? item.term ?? item.text ?? item.value ?? null;
        }
        return null;
      })
      .filter((item) => typeof item === 'string');
  }

  const candidates = [];
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) {
      candidates.push(...pickSuggestionsFromPayload(value));
    } else if (value && typeof value === 'object') {
      candidates.push(...pickSuggestionsFromPayload(value));
    }
  }
  return candidates;
}

function extractSuggestionsFromHtml(html) {
  const suggestions = new Set();
  const jsonMatches = html.match(/\{\"suggestions\"\s*:\s*\[[^]*?\]\}/g);
  if (jsonMatches) {
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);
        pickSuggestionsFromPayload(parsed).forEach((item) => suggestions.add(item));
      } catch (error) {
        console.warn('Failed to parse embedded suggestions JSON', error instanceof Error ? error.message : error);
      }
    }
  }

  const inlineMatches = Array.from(html.matchAll(/"query"\s*:\s*"([^"]+)"/g));
  for (const match of inlineMatches) {
    suggestions.add(match[1]);
  }
  return Array.from(suggestions);
}

function deriveFallbackSuggestions(query) {
  const normalized = normalizeQuery(query);
  const base = normalized.split(/\s+/).filter(Boolean);
  const expansions = [
    `${normalized} ideas`,
    `${normalized} 2024`,
    `${normalized} small business`,
    `${normalized} for gifts`,
    `${normalized} bundle`,
    base.length > 0 ? `${base[0]} supplies` : `${normalized} supplies`,
    base.length > 0 ? `${base[0]} tutorial` : `${normalized} tutorial`,
  ];
  return Array.from(new Set(expansions));
}

async function fetchEtsySuggestions(query, limit) {
  const url = buildRequestUrl(query, limit);
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: `https://www.etsy.com/search?q=${encodeURIComponent(query)}`,
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const result = { raw: null, suggestions: [], source: 'etsy_autocomplete', fallback: false };

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    result.raw = payload;
    result.suggestions = pickSuggestionsFromPayload(payload).slice(0, limit);
    return result;
  }

  const html = await response.text();
  result.raw = html;
  const extracted = extractSuggestionsFromHtml(html);
  if (extracted.length > 0) {
    result.suggestions = extracted.slice(0, limit);
    result.source = 'etsy_html_scrape';
    return result;
  }

  result.fallback = true;
  result.source = 'etsy_heuristic_fallback';
  result.suggestions = deriveFallbackSuggestions(query).slice(0, limit);
  return result;
}

async function persistSuggestions({ supabase, query, normalizedQuery, suggestions, source, extras }) {
  if (!suggestions.length) {
    console.warn(`No suggestions returned for query "${query}"`);
  }

  const { error: insertError } = await supabase.from('etsy_keyword_scrapes').insert({
    query,
    normalized_query: normalizedQuery,
    suggestions,
    source,
    extras,
  });

  if (insertError) {
    throw new Error(`Failed to store scrape for ${query}: ${insertError.message}`);
  }

  if (suggestions.length === 0) {
    return { insertedKeywords: 0 };
  }

  const now = new Date().toISOString();
  const keywordPayload = suggestions.map((suggestion, index) => ({
    term: suggestion.toLowerCase(),
    source: 'etsy-suggest',
    market: 'us',
    tier: 'internal',
    is_seed: false,
    extras: {
      original: suggestion,
      query,
      normalized_query: normalizedQuery,
      position: index,
      scraped_at: now,
      scrape_source: source,
    },
  }));

  const { error: keywordError } = await supabase.from('keywords').upsert(keywordPayload, {
    onConflict: 'term,source,market',
  });

  if (keywordError) {
    throw new Error(`Failed to upsert keywords for ${query}: ${keywordError.message}`);
  }

  return { insertedKeywords: keywordPayload.length };
}

async function main() {
  const queries = parseQueriesFromEnvOrArgs();
  const limit = sanitizeLimit(process.env.ETSY_SUGGESTION_LIMIT ?? process.env.ETSY_LIMIT ?? DEFAULT_LIMIT);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const summary = [];

  for (const query of queries) {
    const normalizedQuery = normalizeQuery(query);
    console.log(`Scraping Etsy suggestions for "${query}" (limit=${limit})`);

    try {
      const { suggestions, raw, source, fallback } = await fetchEtsySuggestions(query, limit);
      const extras = {
        limit,
        fallback,
        source,
        response_meta:
          raw && typeof raw === 'object'
            ? { keys: Object.keys(raw).slice(0, 10) }
            : { snippet: typeof raw === 'string' ? String(raw).slice(0, 240) : null },
      };

      const { insertedKeywords } = await persistSuggestions({
        supabase,
        query,
        normalizedQuery,
        suggestions,
        source,
        extras,
      });

      summary.push({ query, count: suggestions.length, insertedKeywords, source, fallback });
      console.log(
        `Stored ${suggestions.length} suggestions (${insertedKeywords} keyword upserts) for "${query}" via ${source}` +
          (fallback ? ' (fallback used)' : ''),
      );
    } catch (error) {
      console.error(`Failed to scrape query "${query}":`, error instanceof Error ? error.message : error);
      summary.push({ query, count: 0, insertedKeywords: 0, source: 'error', fallback: false, error: String(error) });
    }
  }

  const totalSuggestions = summary.reduce((acc, item) => acc + (item.count ?? 0), 0);
  const totalKeywords = summary.reduce((acc, item) => acc + (item.insertedKeywords ?? 0), 0);

  console.log('Scrape summary:', JSON.stringify(summary, null, 2));
  console.log(`Done. Total suggestions: ${totalSuggestions}, keyword upserts: ${totalKeywords}`);
}

main().catch((error) => {
  console.error('Unexpected scraper failure:', error);
  process.exit(1);
});
