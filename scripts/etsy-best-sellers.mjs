#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
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

const rawLimit = Number.parseInt(process.env.ETSY_BEST_SELLERS_LIMIT ?? process.argv[2] ?? '12', 10);
const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 12;
const categoryInput = process.env.ETSY_BEST_SELLERS_CATEGORY ?? process.argv[3] ?? '';
const outputDir = process.env.ETSY_BEST_SELLERS_OUTPUT_DIR ?? path.join('data', 'etsy', 'best-sellers');
const headless = !/^(0|false|off)$/i.test(process.env.ETSY_BEST_SELLERS_HEADLESS ?? 'true');

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

async function maybeApplyDataDomeCookie(context, response) {
  if (!response || typeof response.headers !== 'function') return false;
  try {
    const headersArray = typeof response.headersArray === 'function'
      ? await response.headersArray()
      : Object.entries(response.headers()).map(([name, value]) => ({ name, value }));
    const setCookieHeaders = headersArray
      .filter((entry) => entry.name.toLowerCase() === 'set-cookie')
      .map((entry) => entry.value);
    for (const header of setCookieHeaders) {
      if (!header.toLowerCase().startsWith(`${DATADOME_COOKIE_NAME}=`)) continue;
      const parsed = parseCookieString(header);
      if (!parsed) continue;
      await context.addCookies([
        {
          name: parsed.name,
          value: parsed.value,
          domain: parsed.domain,
          path: parsed.path,
          secure: parsed.secure,
          httpOnly: parsed.httpOnly,
          sameSite: parsed.sameSite,
          expires: parsed.expires
        }
      ]);
      console.info('Applied DataDome cookie from Etsy response');
      return true;
    }
  } catch (error) {
    console.warn(
      `Failed to apply DataDome cookie: ${error instanceof Error ? error.message : error}`
    );
  }
  return false;
}

async function warmupEtsySession(page) {
  try {
    const response = await page.goto(DEFAULT_REFERER, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    if (response) {
      await maybeApplyDataDomeCookie(page.context(), response);
      if (response.status() === 403) {
        const html = await page.content();
        if (isCaptcha(html)) {
          console.warn('Encountered captcha while priming Etsy session');
        }
      }
    }
  } catch (error) {
    console.warn(
      `Failed to warm up Etsy session: ${error instanceof Error ? error.message : error}`
    );
  }
  try {
    await page.goto('about:blank');
  } catch (error) {
    console.warn(
      `Failed to reset page after warmup: ${error instanceof Error ? error.message : error}`
    );
  }
}

async function gatherBestSellerListingUrls(page, categoryUrl) {
  const candidates = categoryUrl ? Array.from(new Set([categoryUrl, ...BEST_SELLER_CANDIDATES])) : [...BEST_SELLER_CANDIDATES];
  for (const url of candidates) {
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(500);
      const html = await page.content();
      if (!response || !response.ok()) {
        const applied = await maybeApplyDataDomeCookie(page.context(), response);
        console.warn(`Failed to load best sellers ${url}: status=${response?.status() ?? 'unknown'}`);
        if (applied && attempt < 3) {
          await page.waitForTimeout(1500);
          continue;
        }
        break;
      }
      if (isCaptcha(html)) {
        const applied = await maybeApplyDataDomeCookie(page.context(), response);
        if (applied && attempt < 3) {
          console.warn(`Encountered captcha while loading ${url}, retrying`);
          await page.waitForTimeout(1500);
          continue;
        }
        throw new Error(`Encountered captcha while loading ${url}`);
      }
      const urls = extractListingUrlsFromHtml(html, limit);
      if (urls.length) {
        return urls;
      }
      break;
    }
  }
  throw new Error('Unable to locate best seller listings');
}

async function scrapeBestSellersWithPlaywright(categoryUrl) {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    extraHTTPHeaders: {
      ...BASE_HTML_HEADERS,
      Referer: DEFAULT_REFERER,
      'Sec-Fetch-Site': 'same-origin'
    },
    ignoreHTTPSErrors: true
  });

  const envCookie = process.env.ETSY_COOKIE;
  if (envCookie) {
    const potentialCookies = envCookie
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const parsedCookies = [];
    for (const candidate of potentialCookies) {
      const withoutPrefix = candidate.replace(/^set-cookie:/i, '').trim();
      const parsed = parseCookieString(withoutPrefix);
      if (parsed) {
        parsedCookies.push({
          name: parsed.name,
          value: parsed.value,
          domain: parsed.domain || '.etsy.com',
          path: parsed.path || '/',
          secure: typeof parsed.secure === 'boolean' ? parsed.secure : true,
          httpOnly: typeof parsed.httpOnly === 'boolean' ? parsed.httpOnly : false,
          sameSite: parsed.sameSite,
          expires: parsed.expires
        });
        continue;
      }
      parsedCookies.push(...parseCookieHeader(withoutPrefix));
    }
    if (parsedCookies.length) {
      const uniqueCookies = Array.from(
        parsedCookies
          .reverse()
          .reduce((map, cookie) => map.set(cookie.name, cookie), new Map())
          .values()
      ).reverse();
      await context.addCookies(uniqueCookies);
      console.info(`Loaded ${uniqueCookies.length} cookies from ETSY_COOKIE`);
    } else {
      console.warn('ETSY_COOKIE was provided but could not be parsed');
    }
  }
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get() {
        return undefined;
      }
    });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', {
      get() {
        return ['en-US', 'en'];
      }
    });
    Object.defineProperty(navigator, 'platform', {
      get() {
        return 'Win32';
      }
    });
  });
  const page = await context.newPage();

  try {
    await warmupEtsySession(page);
    const urls = await gatherBestSellerListingUrls(page, categoryUrl);
    const selected = urls.slice(0, limit);
    const listings = [];
    for (const url of selected) {
      try {
        listings.push(await scrapeListing(context, url));
      } catch (error) {
        console.warn(`Failed to scrape listing ${url}: ${error instanceof Error ? error.message : error}`);
      }
    }

    if (!listings.length) {
      throw new Error('No listings scraped successfully');
    }

    return { urls, listings, source: 'playwright-best-sellers' };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
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

async function scrapeListing(context, url) {
  const page = await context.newPage();
  try {
    let attempt = 0;
    const maxAttempts = 3;
    let html;
    while (attempt < maxAttempts) {
      attempt += 1;
      let response;
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      } catch (error) {
        console.warn(
          `Failed to load listing ${url} (attempt ${attempt}): ${
            error instanceof Error ? error.message : error
          }`
        );
        if (attempt < maxAttempts) {
          await page.waitForTimeout(1500);
          continue;
        }
        throw error instanceof Error
          ? error
          : new Error(`Failed to load listing ${url}: ${String(error)}`);
      }

      await page.waitForTimeout(500);
      const applied = await maybeApplyDataDomeCookie(context, response);
      html = await page.content();

      if (!response) {
        console.warn(`No response received while fetching listing ${url} (attempt ${attempt})`);
        if (applied && attempt < maxAttempts) {
          await page.waitForTimeout(1500);
          continue;
        }
        throw new Error(`No response while fetching listing ${url}`);
      }

      if (response.status() === 404) {
        throw new Error(`Listing not found: ${url}`);
      }

      if (response.status() === 403) {
        console.warn(
          `Blocked while fetching listing ${url}: status=${response.status()} (attempt ${attempt})`
        );
        if (applied && attempt < maxAttempts) {
          await page.waitForTimeout(1500);
          continue;
        }
        throw new Error(`Blocked while fetching listing ${url}`);
      }

      if (!response.ok()) {
        console.warn(
          `Unexpected status while fetching listing ${url}: status=${response.status()} (attempt ${attempt})`
        );
        if (applied && attempt < maxAttempts) {
          await page.waitForTimeout(1500);
          continue;
        }
        throw new Error(`Failed with status ${response.status()} while fetching listing ${url}`);
      }

      if (isCaptcha(html)) {
        if (applied && attempt < maxAttempts) {
          console.warn(`Encountered captcha for listing ${url}, retrying (attempt ${attempt})`);
          await page.waitForTimeout(1500);
          continue;
        }
        throw new Error(`Encountered captcha for listing ${url}`);
      }

      break;
    }

    if (!html) {
      throw new Error(`Unable to load listing ${url}`);
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
      source: 'playwright-best-sellers'
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const categoryUrl = categoryInput ? sanitizeCategory(categoryInput) : '';
  const mode = (process.env.ETSY_BEST_SELLERS_MODE ?? 'auto').toLowerCase();
  const allowScrape = mode !== 'fixture';
  const allowFixtureFallback = mode !== 'scrape';

  let result = null;

  if (allowScrape) {
    try {
      result = await scrapeBestSellersWithPlaywright(categoryUrl);
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
