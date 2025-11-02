#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns';
import { setTimeout as delay } from 'node:timers/promises';
import { Agent, ProxyAgent } from 'undici';
import sharedBaseHtmlHeaders from '../shared/etsy-base-html-headers.json' with { type: 'json' };

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_REFERER = 'https://www.etsy.com/';
const BASE_HTML_HEADERS = Object.freeze(sharedBaseHtmlHeaders);
const BEST_SELLER_CANDIDATES = [
  'https://www.etsy.com/market/top_sellers',
  'https://www.etsy.com/c/best-selling-items'
];
const FIXTURE_FILE = new URL('./fixtures/etsy-best-sellers-fixture.json', import.meta.url);

const DATADOME_COOKIE_NAME = 'datadome';

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

const fetchAgent = new Agent({
  connect: {
    family: 4,
    timeout: 30000,
    lookup(hostname, options, callback) {
      return dns.lookup(hostname, { ...options, family: 4, all: false }, callback);
    }
  }
});

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy ??
  null;

const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : fetchAgent;

process.once('exit', () => {
  try {
    fetchAgent.close();
  } catch (error) {
    // ignore cleanup failures
  }
  if (proxyUrl && dispatcher && typeof dispatcher.close === 'function') {
    try {
      dispatcher.close();
    } catch (error) {
      // ignore cleanup failures
    }
  }
});

const rawLimit = Number.parseInt(process.env.ETSY_BEST_SELLERS_LIMIT ?? process.argv[2] ?? '12', 10);
const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 12;
const categoryInput = process.env.ETSY_BEST_SELLERS_CATEGORY ?? process.argv[3] ?? '';
const outputDir = process.env.ETSY_BEST_SELLERS_OUTPUT_DIR ?? path.join('data', 'etsy', 'best-sellers');

function sanitizeCategory(category) {
  if (!category) return '';
  try {
    const url = new URL(category);
    if (/etsy\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
      if (!url.searchParams.has('ref')) {
        url.searchParams.set('ref', 'best_sellers');
      }
      return url.toString();
    }
  } catch (error) {
    // fallthrough to slug handling
  }
  const sanitized = category.replace(/^\/+/, '').replace(/\?.*$/, '');
  const pathSegment = /^(c|featured)\//i.test(sanitized) ? sanitized : `c/${sanitized}`;
  return `https://www.etsy.com/${pathSegment}?ref=best_sellers`;
}

function ensureAbsoluteEtsyUrl(input) {
  if (!input) return null;
  try {
    const hasProtocol = /^https?:/i.test(input);
    const normalized = hasProtocol ? input : `https://www.etsy.com${input.startsWith('/') ? '' : '/'}${input}`;
    const url = new URL(normalized);
    url.hash = '';
    url.search = '';
    if (!/etsy\.com$/i.test(url.hostname) && !/etsy\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
      return null;
    }
    return url.toString();
  } catch (error) {
    return null;
  }
}

function extractListingUrlsFromHtml(html, desiredLimit) {
  const seen = new Set();
  const urls = [];
  const hrefMatches = html.matchAll(/href=\"([^\"]*\/listing\/\d+[^\"]*)\"/gi);
  for (const [, rawHref] of hrefMatches) {
    const normalized = ensureAbsoluteEtsyUrl(rawHref);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
    if (urls.length >= desiredLimit) break;
  }
  if (urls.length < desiredLimit) {
    const idMatches = html.matchAll(/data-listing-id=\"(\d+)\"/gi);
    for (const [, id] of idMatches) {
      const normalized = ensureAbsoluteEtsyUrl(`/listing/${id}`);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
      if (urls.length >= desiredLimit) break;
    }
  }
  if (urls.length < desiredLimit) {
    const jsonMatches = html.matchAll(/listing_id":\s*(\d+)/gi);
    for (const [, id] of jsonMatches) {
      const normalized = ensureAbsoluteEtsyUrl(`/listing/${id}`);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
      if (urls.length >= desiredLimit) break;
    }
  }
  return urls;
}

function parseJsonLd(html) {
  const scripts = Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
  const payloads = [];
  for (const [, raw] of scripts) {
    if (!raw) continue;
    try {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        payloads.push(...parsed);
      } else {
        payloads.push(parsed);
      }
    } catch (error) {
      // swallow parse errors to keep scraping resilient
    }
  }
  return payloads;
}

function arrayFromValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)));
  }
  if (typeof value === 'string') {
    return Array.from(new Set(value.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean)));
  }
  return [];
}

function extractMeta(html, property) {
  const escaped = property.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = html.match(regex);
  return match?.[1] ?? null;
}

function isCaptcha(html) {
  return /captcha/i.test(html) && /etsy/i.test(html);
}

function parseCookieString(cookie) {
  const [pair, ...attributes] = cookie.split(';');
  const [rawName, ...rawValueParts] = pair.split('=');
  if (!rawName || !rawValueParts.length) return null;
  const name = rawName.trim();
  const value = rawValueParts.join('=').trim();
  if (!name || typeof value === 'undefined') return null;
  const attrMap = new Map();
  for (const attribute of attributes) {
    const [attrName, ...attrValueParts] = attribute.split('=');
    const key = attrName.trim().toLowerCase();
    const attrValue = attrValueParts.join('=').trim();
    attrMap.set(key, attrValue ?? '');
  }
  const sameSiteRaw = attrMap.get('samesite');
  const sameSite = sameSiteRaw
    ? sameSiteRaw.toLowerCase() === 'lax'
      ? 'Lax'
      : sameSiteRaw.toLowerCase() === 'strict'
      ? 'Strict'
      : sameSiteRaw.toLowerCase() === 'none'
      ? 'None'
      : undefined
    : undefined;
  const maxAge = Number.parseInt(attrMap.get('max-age') ?? '', 10);
  const expires = attrMap.get('expires');
  return {
    name,
    value,
    domain: attrMap.get('domain') || '.etsy.com',
    path: attrMap.get('path') || '/',
    secure: attrMap.has('secure') || attrMap.get('secure') === '',
    httpOnly: attrMap.has('httponly') || attrMap.get('httponly') === '',
    sameSite,
    expires:
      Number.isFinite(maxAge) && maxAge > 0
        ? Math.floor(Date.now() / 1000) + maxAge
        : expires
        ? Math.floor(new Date(expires).getTime() / 1000)
        : undefined
  };
}

function parseCookieHeader(header) {
  if (!header) return [];
  const normalized = header.replace(/^cookie:/i, '').trim();
  if (!normalized) return [];
  const segments = normalized.split(/;\s*/);
  const cookies = [];
  for (const segment of segments) {
    const index = segment.indexOf('=');
    if (index === -1) continue;
    const name = segment.slice(0, index).trim();
    const value = segment.slice(index + 1).trim();
    if (!name) continue;
    cookies.push({
      name,
      value,
      domain: '.etsy.com',
      path: '/',
      secure: true,
      httpOnly: false
    });
  }
  return cookies;
}

function secondsToEpochMillis(value) {
  if (!Number.isFinite(value)) return undefined;
  return value > 1e12 ? value : value * 1000;
}

function isCookieExpired(cookie) {
  if (!cookie || typeof cookie !== 'object') return true;
  if (typeof cookie.expires === 'undefined') return false;
  const expiresMs = secondsToEpochMillis(Number(cookie.expires));
  if (!Number.isFinite(expiresMs)) return false;
  return Date.now() >= expiresMs;
}

function domainMatchesCookie(cookieDomain, hostname) {
  if (!cookieDomain) return true;
  const normalized = cookieDomain.replace(/^\./, '').toLowerCase();
  const host = hostname.toLowerCase();
  return host === normalized || host.endsWith(`.${normalized}`);
}

function pathMatchesCookie(cookiePath, requestPath) {
  if (!cookiePath) return true;
  if (requestPath.startsWith(cookiePath)) return true;
  if (!cookiePath.endsWith('/')) {
    return requestPath.startsWith(`${cookiePath}/`);
  }
  return false;
}

function buildCookieHeaderFromJar(cookieJar, url) {
  if (!cookieJar?.size) return '';
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (error) {
    return '';
  }
  const { hostname, pathname, protocol } = parsedUrl;
  const secure = protocol === 'https:';
  const entries = [];
  for (const cookie of cookieJar.values()) {
    if (isCookieExpired(cookie)) {
      cookieJar.delete(cookie.name);
      continue;
    }
    if (cookie.secure && !secure) continue;
    if (!domainMatchesCookie(cookie.domain, hostname)) continue;
    if (!pathMatchesCookie(cookie.path, pathname)) continue;
    entries.push(`${cookie.name}=${cookie.value}`);
  }
  return entries.join('; ');
}

function setCookieInJar(cookieJar, cookie) {
  if (!cookie || !cookie.name) return;
  const normalized = {
    ...cookie,
    name: cookie.name,
    value: cookie.value ?? '',
    domain: (cookie.domain || '.etsy.com').toLowerCase(),
    path: cookie.path || '/',
    secure: typeof cookie.secure === 'boolean' ? cookie.secure : true,
    httpOnly: typeof cookie.httpOnly === 'boolean' ? cookie.httpOnly : false,
    sameSite: cookie.sameSite,
    expires: typeof cookie.expires === 'undefined' ? undefined : Number(cookie.expires)
  };
  cookieJar.set(normalized.name, normalized);
}

function applyCookiesFromHeader(cookieJar, header) {
  if (!header) return;
  const parsed = parseCookieString(header);
  if (parsed) {
    setCookieInJar(cookieJar, parsed);
    return;
  }
  for (const cookie of parseCookieHeader(header)) {
    setCookieInJar(cookieJar, cookie);
  }
}

function getSetCookieHeaders(response) {
  if (!response?.headers) return [];
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const raw = response.headers.get('set-cookie');
  if (!raw) return [];
  const parts = [];
  let buffer = '';
  let inQuotes = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (!inQuotes && char === ',') {
      const next = raw.slice(index + 1).trimStart();
      if (/^[^=]+=/.test(next)) {
        parts.push(buffer.trim());
        buffer = '';
        continue;
      }
    }
    buffer += char;
  }
  if (buffer.trim()) {
    parts.push(buffer.trim());
  }
  return parts;
}

function updateCookieJarFromResponse(cookieJar, response) {
  const headers = getSetCookieHeaders(response);
  if (!headers.length) return;
  for (const header of headers) {
    applyCookiesFromHeader(cookieJar, header);
  }
}

function applyEnvCookies(cookieJar, envCookie) {
  if (!envCookie) return;
  const potentialCookies = envCookie
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const candidate of potentialCookies) {
    const withoutPrefix = candidate.replace(/^set-cookie:/i, '').trim();
    applyCookiesFromHeader(cookieJar, withoutPrefix);
  }
}

function getCookieValue(cookieJar, name) {
  if (!cookieJar?.size || !name) return null;
  const cookie = cookieJar.get(name);
  if (!cookie || isCookieExpired(cookie)) {
    cookieJar.delete(name);
    return null;
  }
  return cookie.value ?? null;
}

async function fetchEtsyHtml(cookieJar, url, { referer = DEFAULT_REFERER, maxAttempts = 4, allowNotFound = false } = {}) {
  let attempt = 0;
  let lastError = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    const headers = {
      ...BASE_HTML_HEADERS,
      Referer: referer,
      'User-Agent': USER_AGENT,
      Connection: 'keep-alive',
      'Sec-Fetch-Site': referer ? 'same-origin' : 'none'
    };
    const cookieHeader = buildCookieHeaderFromJar(cookieJar, url);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const previousDataDome = getCookieValue(cookieJar, DATADOME_COOKIE_NAME);
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        dispatcher
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        throw error instanceof Error ? error : new Error(`Failed to fetch ${url}: ${String(error)}`);
      }
      await delay(1000);
      continue;
    }

    const html = await response.text();
    updateCookieJarFromResponse(cookieJar, response);
    const currentDataDome = getCookieValue(cookieJar, DATADOME_COOKIE_NAME);
    const dataDomeUpdated = currentDataDome && currentDataDome !== previousDataDome;
    if (dataDomeUpdated) {
      console.info('Applied DataDome cookie from Etsy response');
    }

    if (response.status === 404 && allowNotFound) {
      return { status: response.status, html };
    }

    if (response.status === 403 || response.status === 429) {
      if ((dataDomeUpdated || /datadome/i.test(html)) && attempt < maxAttempts) {
        console.warn(`Received ${response.status} for ${url}; retrying after applying DataDome cookie`);
        await delay(1000);
        continue;
      }
      if (attempt >= maxAttempts) {
        throw new Error(`Blocked while loading ${url}`);
      }
      await delay(1000);
      continue;
    }

    if (!response.ok) {
      if (attempt >= maxAttempts) {
        throw new Error(`Failed with status ${response.status} while loading ${url}`);
      }
      await delay(1000);
      continue;
    }

    if (isCaptcha(html) || /datadome/i.test(html)) {
      if (attempt >= maxAttempts) {
        throw new Error(`Encountered captcha while loading ${url}`);
      }
      await delay(1000);
      continue;
    }

    return { status: response.status, html };
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error(`Unable to load ${url}: ${String(lastError)}`);
  }
  throw new Error(`Unable to load ${url}`);
}


async function gatherBestSellerListingUrls(cookieJar, categoryUrl) {
  const candidates = categoryUrl
    ? Array.from(new Set([categoryUrl, ...BEST_SELLER_CANDIDATES]))
    : [...BEST_SELLER_CANDIDATES];
  for (const url of candidates) {
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const { html } = await fetchEtsyHtml(cookieJar, url, { maxAttempts: 3 });
        const urls = extractListingUrlsFromHtml(html, limit);
        if (urls.length) {
          return urls;
        }
      } catch (error) {
        console.warn(
          `Failed to load best sellers ${url} (attempt ${attempt}): ${error instanceof Error ? error.message : error}`
        );
        if (attempt < 3) {
          await delay(1500);
          continue;
        }
      }
      break;
    }
  }
  throw new Error('Unable to locate best seller listings');
}

async function scrapeBestSellersWithFetch(categoryUrl) {
  const cookieJar = new Map();
  applyEnvCookies(cookieJar, process.env.ETSY_COOKIE);
  if (cookieJar.size) {
    console.info(`Loaded ${cookieJar.size} cookies from ETSY_COOKIE`);
  }

  const urls = await gatherBestSellerListingUrls(cookieJar, categoryUrl);
  const selected = urls.slice(0, limit);
  const listings = [];
  for (const url of selected) {
    try {
      listings.push(await scrapeListing(cookieJar, url));
    } catch (error) {
      console.warn(`Failed to scrape listing ${url}: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!listings.length) {
    throw new Error('No listings scraped successfully');
  }

  return { urls, listings, source: 'fetch-best-sellers' };
}

async function loadFixtureBestSellers(desiredLimit) {
  try {
    const raw = await fs.readFile(FIXTURE_FILE, 'utf8');
    const payload = JSON.parse(raw);
    const fromFile = Array.isArray(payload?.listings) ? payload.listings : [];
    const listings = fromFile.slice(0, desiredLimit).map((listing) => ({
      ...listing,
      fetchedAt: new Date().toISOString(),
      source: 'fixture-best-sellers'
    }));
    const urls = listings.map((listing) => listing.url).filter(Boolean);
    if (!listings.length) {
      throw new Error('Fixture does not contain any listings');
    }
    console.warn('Using Etsy best seller fixture data');
    return { urls, listings, source: 'fixture-best-sellers' };
  } catch (error) {
    throw new Error(
      `Unable to load Etsy best seller fixture: ${error instanceof Error ? error.message : error}`
    );
  }
}

async function scrapeListing(cookieJar, url) {
  const { status, html } = await fetchEtsyHtml(cookieJar, url, {
    maxAttempts: 4,
    allowNotFound: true,
    referer: DEFAULT_REFERER
  });

  if (status === 404) {
    throw new Error(`Listing not found: ${url}`);
  }

  const jsonLd = parseJsonLd(html);
    const product = jsonLd.find((entry) =>
      entry && typeof entry === 'object' && /product/i.test(String(entry['@type'] ?? ''))
    ) ?? {};
    const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];
    const firstOffer = offers.find((offer) => offer && typeof offer === 'object') ?? {};
    const seller = product.seller ?? product.brand ?? {};
    const sellerAddress = seller.address && typeof seller.address === 'object' ? seller.address : {};
    const aggregateRating = product.aggregateRating && typeof product.aggregateRating === 'object'
      ? product.aggregateRating
      : {};

    const idFromUrl = /listing\/(\d+)/.exec(url)?.[1] ?? null;
    const idFromJson = typeof product.productID === 'string'
      ? product.productID
      : typeof product.sku === 'string'
      ? product.sku
      : typeof product.identifier === 'string'
      ? product.identifier
      : null;

    const priceValue = typeof firstOffer.price === 'number' ? firstOffer.price : Number(firstOffer.price ?? Number.NaN);
    const freeShipping = (() => {
      if (firstOffer && typeof firstOffer.shippingDetails === 'object' && firstOffer.shippingDetails) {
        const details = firstOffer.shippingDetails;
        if (typeof details.freeShipping === 'boolean') return details.freeShipping;
        if (details.shippingRate && typeof details.shippingRate.price !== 'undefined') {
          const amount = Number(details.shippingRate.price);
          if (Number.isFinite(amount)) return amount === 0;
        }
      }
      return null;
    })();

    const images = (() => {
      const fromJson = arrayFromValue(product.image);
      if (fromJson.length) return fromJson;
      const og = extractMeta(html, 'og:image');
      return og ? [og] : [];
    })();

    return {
      id: idFromJson ?? idFromUrl,
      url,
      title: typeof product.name === 'string' ? product.name : extractMeta(html, 'og:title'),
      description:
        typeof product.description === 'string' ? product.description : extractMeta(html, 'og:description'),
      price: {
        amount: Number.isFinite(priceValue) ? Number(priceValue) : null,
        currency: typeof firstOffer.priceCurrency === 'string' ? firstOffer.priceCurrency : null
      },
      images,
      tags: arrayFromValue(product.keywords ?? product.category ?? []),
      materials: arrayFromValue(product.material ?? []),
      categoryPath: arrayFromValue(product.categoryPath ?? []),
      shop: {
        id:
          typeof seller.identifier === 'string'
            ? seller.identifier
            : typeof seller['@id'] === 'string'
            ? seller['@id']
            : null,
        name: typeof seller.name === 'string' ? seller.name : null,
        url: typeof seller.url === 'string' ? seller.url : null,
        location: typeof sellerAddress.addressLocality === 'string' ? sellerAddress.addressLocality : null
      },
      reviews: {
        count: Number(aggregateRating.reviewCount ?? aggregateRating.ratingCount ?? Number.NaN) || null,
        rating: Number(aggregateRating.ratingValue ?? Number.NaN) || null
      },
      shipping: {
        freeShipping,
        shipsFrom:
          typeof firstOffer.availableAtOrFrom === 'string'
            ? firstOffer.availableAtOrFrom
            : typeof firstOffer.areaServed === 'string'
            ? firstOffer.areaServed
            : null,
        processingTime:
          typeof firstOffer.deliveryLeadTime === 'string'
            ? firstOffer.deliveryLeadTime
            : firstOffer.shippingDetails && typeof firstOffer.shippingDetails === 'object'
            ? firstOffer.shippingDetails.handlingTime ?? null
            : null
      },
      fetchedAt: new Date().toISOString(),
      source: 'fetch-best-sellers'
    };
}

async function main() {
  const categoryUrl = categoryInput ? sanitizeCategory(categoryInput) : '';
  const mode = (process.env.ETSY_BEST_SELLERS_MODE ?? 'auto').toLowerCase();
  const allowScrape = mode !== 'fixture';
  const allowFixtureFallback = mode !== 'scrape';

  let result = null;

  if (allowScrape) {
    try {
      result = await scrapeBestSellersWithFetch(categoryUrl);
    } catch (error) {
      console.warn(
        `Failed to scrape Etsy best sellers: ${error instanceof Error ? error.message : error}`
      );
      if (!allowFixtureFallback) {
        throw error;
      }
    }
  }

  if (!result && allowFixtureFallback) {
    result = await loadFixtureBestSellers(limit);
  }

  if (!result) {
    throw new Error('Unable to collect any Etsy best seller listings');
  }

  const { urls, listings, source } = result;

  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(outputDir, `best-sellers-${timestamp}.json`);
  await fs.writeFile(
    filename,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        category: categoryUrl || null,
        limit,
        discovered: urls.length,
        collected: listings.length,
        listings,
        source
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`Saved ${listings.length} listings to ${filename} (${source})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
