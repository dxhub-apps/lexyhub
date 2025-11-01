import { setTimeout as delay } from "node:timers/promises";

import type { EtsyProvider } from "./provider";
import {
  EtsyProviderError,
  type NormalizedEtsyListing,
  type NormalizedEtsyShop,
  type SearchOptions,
} from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const BASE_HTML_HEADERS = Object.freeze({
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Sec-CH-UA": '"Chromium";v="124", "Not.A/Brand";v="8"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"Windows"',
});
const DEFAULT_REFERER = "https://www.etsy.com/";

function buildNavigationHeaders(referer: string = DEFAULT_REFERER): Record<string, string> {
  return {
    ...BASE_HTML_HEADERS,
    Referer: referer,
  };
}
const MIN_INTERVAL_MS = 1_500;

const BEST_SELLERS_URLS = Object.freeze([
  "https://www.etsy.com/market/top_sellers",
  "https://www.etsy.com/c/best-selling-items",
]);
const PRIMARY_BEST_SELLERS_URL = BEST_SELLERS_URLS[0];

class RequestThrottle {
  private static lastInvocation = 0;

  private static pending: Promise<void> = Promise.resolve();

  static async schedule(): Promise<void> {
    this.pending = this.pending.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, this.lastInvocation + MIN_INTERVAL_MS - now);
      if (wait > 0) {
        await delay(wait);
      }
      this.lastInvocation = Date.now();
    });
    return this.pending;
  }
}

class CookieJar {
  private readonly cookies = new Map<string, string>();

  inject(initHeaders?: HeadersInit): Headers {
    const headers = new Headers(initHeaders);
    if (this.cookies.size > 0 && !headers.has("cookie")) {
      headers.set("cookie", this.serialize());
    }
    return headers;
  }

  absorb(response: Response): void {
    const setCookies = this.getSetCookies(response);
    for (const raw of setCookies) {
      if (!raw) continue;
      const [pair] = raw.split(";");
      if (!pair) continue;
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex === -1) continue;
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name || !value) continue;
      this.cookies.set(name, value);
    }
  }

  private serialize(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private getSetCookies(response: Response): string[] {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    if (typeof headers.getSetCookie === "function") {
      return headers.getSetCookie();
    }
    const combined = response.headers.get("set-cookie");
    return combined ? [combined] : [];
  }
}

function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  if (!/etsy\.com$/i.test(url.hostname) && !/etsy\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
    throw new EtsyProviderError(`Unsupported hostname: ${url.hostname}`, "INVALID_URL", { canRetry: false });
  }
  return url.toString();
}

function ensureAbsoluteEtsyUrl(input: string): string | null {
  try {
    const hasProtocol = /^https?:/i.test(input);
    const normalized = hasProtocol ? input : `https://www.etsy.com${input.startsWith("/") ? "" : "/"}${input}`;
    return normalizeUrl(normalized);
  } catch {
    return null;
  }
}

function extractListingUrlsFromHtml(html: string, limit: number): string[] {
  const matches = html.matchAll(/href=\"([^\"]*\/listing\/\d+[^\"]*)\"/gi);
  const results: string[] = [];
  const seen = new Set<string>();
  for (const [, rawHref] of matches) {
    if (!rawHref) {
      continue;
    }
    const normalized = ensureAbsoluteEtsyUrl(rawHref);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push(normalized);
    if (results.length >= limit) {
      break;
    }
  }
  if (results.length < limit) {
    for (const match of html.matchAll(/data-listing-id="(\d+)"/gi)) {
      const candidate = ensureAbsoluteEtsyUrl(`/listing/${match[1]}`);
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        results.push(candidate);
        if (results.length >= limit) {
          break;
        }
      }
    }
  }
  if (results.length < limit) {
    for (const match of html.matchAll(/listing_id":\s*(\d+)/gi)) {
      const candidate = ensureAbsoluteEtsyUrl(`/listing/${match[1]}`);
      if (candidate && !seen.has(candidate)) {
        seen.add(candidate);
        results.push(candidate);
        if (results.length >= limit) {
          break;
        }
      }
    }
  }
  return results;
}

function extractListingContext(url: string): { id: string | null; slug: string | null } {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const listingIndex = segments.findIndex((segment) => segment.toLowerCase() === "listing");
    if (listingIndex === -1) {
      return { id: null, slug: null };
    }
    const id = segments[listingIndex + 1] ?? null;
    const slug = segments[listingIndex + 2] ?? null;
    return { id, slug };
  } catch {
    return { id: null, slug: null };
  }
}

function buildListingReferers(url: string): string[] {
  const referers = new Set<string>([DEFAULT_REFERER]);
  const context = extractListingContext(url);
  if (context.id) {
    referers.add(`https://www.etsy.com/listing/${context.id}`);
  }
  if (context.slug) {
    const searchQuery = context.slug.replace(/[-_]+/g, " ").trim();
    if (searchQuery) {
      referers.add(`https://www.etsy.com/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }
  referers.add(PRIMARY_BEST_SELLERS_URL);
  return Array.from(referers);
}

function extractJsonLd(html: string): unknown[] {
  const scripts = Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
  const payloads: unknown[] = [];
  for (const [, raw] of scripts) {
    try {
      if (!raw) {
        continue;
      }
      const cleaned = raw.trim();
      if (!cleaned) {
        continue;
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        payloads.push(...parsed);
      } else {
        payloads.push(parsed);
      }
    } catch (error) {
      console.warn("Failed to parse Etsy JSON-LD payload", error);
    }
  }
  return payloads;
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(regex);
  return match?.[1] ?? null;
}

function valueArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
    return Array.from(new Set(normalized));
  }
  if (typeof value === "string") {
    const normalized = value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return Array.from(new Set(normalized));
  }
  return [];
}

function normalizeListing(url: string, html: string, jsonLd: unknown[]): NormalizedEtsyListing {
  const product = jsonLd.find((entry) =>
    typeof entry === "object" && entry !== null ? /product/i.test(String((entry as Record<string, unknown>)["@type"])) : false,
  ) as Record<string, unknown> | undefined;
  const offers = product?.offers;
  const offersArray = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const firstOffer = offersArray.find((offer) => typeof offer === "object" && offer !== null) as
    | Record<string, unknown>
    | undefined;
  const seller = (product?.seller ?? product?.brand) as Record<string, unknown> | undefined;
  const sellerAddress =
    typeof seller?.address === "object" && seller.address !== null
      ? (seller.address as Record<string, unknown>)
      : null;
  const aggregateRating = product?.aggregateRating as Record<string, unknown> | undefined;

  const idFromUrl = /listing\/(\d+)/.exec(url)?.[1] ?? null;
  const idFromJson =
    typeof product?.productID === "string"
      ? product?.productID
      : typeof product?.sku === "string"
      ? product?.sku
      : typeof product?.identifier === "string"
      ? product?.identifier
      : null;

  const price = typeof firstOffer?.price === "number" ? firstOffer.price : Number(firstOffer?.price ?? Number.NaN);
  const freeShipping = (() => {
    if (typeof firstOffer?.shippingDetails === "object" && firstOffer.shippingDetails !== null) {
      const details = firstOffer.shippingDetails as Record<string, unknown>;
      if (typeof details.freeShipping === "boolean") {
        return details.freeShipping;
      }
      const rate = details.shippingRate as Record<string, unknown> | undefined;
      if (rate && typeof rate.price === "number") {
        return rate.price === 0;
      }
      if (rate && typeof rate.price === "string") {
        return Number(rate.price) === 0;
      }
    }
    return null;
  })();

  const images = (() => {
    const fromJson = valueArray(product?.image);
    if (fromJson.length > 0) {
      return fromJson;
    }
    const ogImage = extractMeta(html, "og:image");
    return ogImage ? [ogImage] : [];
  })();

  const normalized: NormalizedEtsyListing = {
    id: idFromJson ?? idFromUrl,
    url,
    title: typeof product?.name === "string" ? product.name : extractMeta(html, "og:title"),
    description:
      typeof product?.description === "string"
        ? product.description
        : extractMeta(html, "og:description") ?? null,
    price: {
      amount: Number.isFinite(price) ? Number(price) : null,
      currency: typeof firstOffer?.priceCurrency === "string" ? firstOffer.priceCurrency : null,
    },
    images,
    tags: valueArray(product?.keywords ?? (product?.additionalProperty as Record<string, unknown> | undefined)?.value),
    materials: valueArray(product?.material),
    categoryPath: valueArray(product?.category ?? product?.categoryPath),
    shop: {
      id:
        typeof seller?.identifier === "string"
          ? seller.identifier
          : typeof seller?.["@id"] === "string"
          ? (seller["@id"] as string)
          : null,
      name: typeof seller?.name === "string" ? seller.name : null,
      url: typeof seller?.url === "string" ? seller.url : null,
      location: typeof sellerAddress?.addressLocality === "string" ? (sellerAddress.addressLocality as string) : null,
    },
    reviews: {
      count: Number(aggregateRating?.reviewCount ?? aggregateRating?.ratingCount ?? Number.NaN) || null,
      rating: Number(aggregateRating?.ratingValue ?? Number.NaN) || null,
    },
    shipping: {
      freeShipping,
      shipsFrom:
        typeof firstOffer?.availableAtOrFrom === "string"
          ? firstOffer.availableAtOrFrom
          : typeof firstOffer?.areaServed === "string"
          ? firstOffer.areaServed
          : null,
      processingTime:
        typeof firstOffer?.deliveryLeadTime === "string"
          ? firstOffer.deliveryLeadTime
          : typeof firstOffer?.shippingDetails === "object" && firstOffer?.shippingDetails !== null
          ? (firstOffer.shippingDetails as Record<string, unknown>).handlingTime as string | null
          : null,
    },
    raw: {
      jsonLd: product ?? null,
      offers: firstOffer ?? null,
    },
    fetchedAt: new Date().toISOString(),
    source: "scrape" as const,
  };

  return normalized;
}

function countExtractedFields(listing: NormalizedEtsyListing): number {
  let count = 0;
  if (listing.id) count += 1;
  if (listing.title) count += 1;
  if (listing.description) count += 1;
  if (listing.price.amount != null) count += 1;
  if (listing.price.currency) count += 1;
  if (listing.images.length) count += 1;
  if (listing.tags.length) count += 1;
  if (listing.materials.length) count += 1;
  if (listing.categoryPath.length) count += 1;
  if (listing.shop.name) count += 1;
  if (listing.reviews.count != null || listing.reviews.rating != null) count += 1;
  if (listing.shipping.freeShipping != null || listing.shipping.shipsFrom || listing.shipping.processingTime) count += 1;
  return count;
}

export class ScrapeEtsyProvider implements EtsyProvider {
  private readonly cookieJar = new CookieJar();

  private async fetchWithCookies(url: string, init?: RequestInit): Promise<Response> {
    const headers = this.cookieJar.inject(init?.headers);
    const response = await fetch(url, { ...init, headers });
    this.cookieJar.absorb(response);
    return response;
  }

  private async fetchListingDocument(url: string): Promise<Response> {
    const referers = buildListingReferers(url);
    let attempt = 0;
    let lastResponse: Response | null = null;

    for (const referer of referers) {
      await RequestThrottle.schedule();
      const response = await this.fetchWithCookies(url, {
        headers: buildNavigationHeaders(referer),
      });

      if (response.status !== 403) {
        return response;
      }

      lastResponse = response;
      attempt += 1;
      console.warn(
        JSON.stringify({
          method: "ScrapeEtsyProvider.getListingByUrl",
          url,
          status: "blocked",
          referer,
          attempt,
          status_code: response.status,
        }),
      );
    }

    if (lastResponse) {
      return lastResponse;
    }

    await RequestThrottle.schedule();
    return this.fetchWithCookies(url, {
      headers: buildNavigationHeaders(DEFAULT_REFERER),
    });
  }

  private buildBestSellerUrl(category?: string): string {
    if (!category) {
      return PRIMARY_BEST_SELLERS_URL;
    }

    try {
      const maybeUrl = new URL(category);
      if (/etsy\.com$/i.test(maybeUrl.hostname.replace(/^www\./, ""))) {
        if (!maybeUrl.searchParams.has("ref")) {
          maybeUrl.searchParams.set("ref", "best_sellers");
        }
        return maybeUrl.toString();
      }
    } catch {
      // fall back to slug handling
    }

    const sanitized = category.replace(/^\/+/, "").replace(/\?.*$/, "");
    const path = /^(c|featured)\//i.test(sanitized) ? sanitized : `c/${sanitized}`;
    return `https://www.etsy.com/${path}?ref=best_sellers`;
  }

  private async gatherBestSellerListingUrls(limit: number, category?: string): Promise<string[]> {
    const targetLimit = Math.max(1, Math.min(limit, 20));
    const candidateUrls = category
      ? Array.from(new Set([this.buildBestSellerUrl(category), ...BEST_SELLERS_URLS]))
      : [...BEST_SELLERS_URLS];

    let lastNotFound: EtsyProviderError | null = null;

    for (const url of candidateUrls) {
      await RequestThrottle.schedule();
      const response = await this.fetchWithCookies(url, {
        headers: buildNavigationHeaders(DEFAULT_REFERER),
      });

      if (!response.ok) {
        if (response.status === 404) {
          lastNotFound = new EtsyProviderError("Best seller category not found", "NOT_FOUND", {
            status: response.status,
            canRetry: false,
          });
          console.warn(
            JSON.stringify({
              method: "ScrapeEtsyProvider.gatherBestSellerListingUrls",
              url,
              status: "not_found",
              status_code: response.status,
            }),
          );
          continue;
        }
        if (response.status === 403) {
          throw new EtsyProviderError("Blocked while loading Etsy best sellers", "BLOCKED", {
            status: response.status,
            canRetry: false,
          });
        }
        throw new EtsyProviderError(`Failed to load best seller category (${response.status})`, "FETCH_FAILED", {
          status: response.status,
          canRetry: response.status >= 500 || response.status === 429,
        });
      }

      const html = await response.text();
      if (/captcha/i.test(html) && /etsy/i.test(html)) {
        throw new EtsyProviderError("Encountered Etsy captcha", "BLOCKED", { status: 429, canRetry: true });
      }

      const urls = extractListingUrlsFromHtml(html, targetLimit);
      if (!urls.length) {
        throw new EtsyProviderError("Unable to locate best seller listings", "NOT_FOUND", { canRetry: true });
      }

      console.info(
        JSON.stringify({
          method: "ScrapeEtsyProvider.gatherBestSellerListingUrls",
          url,
          status: "success",
          discovered: urls.length,
        }),
      );

      return urls;
    }

    throw lastNotFound ?? new EtsyProviderError("Best seller listings unavailable", "FETCH_FAILED", { canRetry: true });
  }

  async getListingByUrl(url: string): Promise<NormalizedEtsyListing> {
    const started = Date.now();
    const normalizedUrl = normalizeUrl(url);
    try {
      const response = await this.fetchListingDocument(normalizedUrl);

      if (response.status === 404) {
        throw new EtsyProviderError("Listing not found", "NOT_FOUND", { status: 404, canRetry: false });
      }

      if (!response.ok) {
        if (response.status === 403) {
          throw new EtsyProviderError("Blocked while fetching Etsy listing", "BLOCKED", {
            status: response.status,
            canRetry: true,
          });
        }
        throw new EtsyProviderError(`Failed to fetch listing (${response.status})`, "FETCH_FAILED", {
          status: response.status,
          canRetry: response.status >= 500 || response.status === 429,
        });
      }

      const html = await response.text();
      if (/captcha/i.test(html) && /etsy/i.test(html)) {
        throw new EtsyProviderError("Encountered Etsy captcha", "BLOCKED", { status: 429, canRetry: true });
      }

      const jsonLd = extractJsonLd(html);
      const listing = normalizeListing(normalizedUrl, html, jsonLd);

      console.info(
        JSON.stringify({
          method: "ScrapeEtsyProvider.getListingByUrl",
          url: normalizedUrl,
          status: "success",
          duration_ms: Date.now() - started,
          provider: "scrape",
          fields_extracted: countExtractedFields(listing),
        }),
      );

      return listing;
    } catch (error) {
      console.error(
        JSON.stringify({
          method: "ScrapeEtsyProvider.getListingByUrl",
          url: normalizedUrl,
          status: "error",
          duration_ms: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  async getShopByUrl(_url: string): Promise<NormalizedEtsyShop> {
    throw new EtsyProviderError("Shop lookup not implemented", "UNKNOWN", { canRetry: false });
  }

  async search(query: string, options?: SearchOptions): Promise<NormalizedEtsyListing[]> {
    const strategy = options?.strategy ?? "keyword";
    if (strategy !== "best-sellers") {
      throw new EtsyProviderError("Search strategy not implemented", "UNKNOWN", { canRetry: false });
    }

    const started = Date.now();
    const limit = Math.max(1, Math.min(options?.limit ?? 1, 20));
    const category = options?.category;

    const urls = await this.gatherBestSellerListingUrls(limit, category);
    const listings: NormalizedEtsyListing[] = [];
    for (const url of urls) {
      try {
        listings.push(await this.getListingByUrl(url));
      } catch (error) {
        console.warn(
          JSON.stringify({
            method: "ScrapeEtsyProvider.search",
            strategy: "best-sellers",
            url,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      if (listings.length >= limit) {
        break;
      }
    }

    if (!listings.length) {
      throw new EtsyProviderError("Best seller listings unavailable", "FETCH_FAILED", { canRetry: true });
    }

    console.info(
      JSON.stringify({
        method: "ScrapeEtsyProvider.search",
        strategy: "best-sellers",
        status: "success",
        duration_ms: Date.now() - started,
        provider: "scrape",
        category: category ?? null,
        count: listings.length,
      }),
    );

    return listings.slice(0, limit);
  }
}

export { buildListingReferers, extractListingContext };
