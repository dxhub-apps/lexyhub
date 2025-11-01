import type { NormalizedEtsyListing } from "./types";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
  listing: NormalizedEtsyListing;
  expiresAt: number;
};

const urlCache = new Map<string, CacheEntry>();
const idCache = new Map<string, CacheEntry>();

function normalizeKey(input: string): string {
  return input.trim().toLowerCase();
}

function prune(entry: CacheEntry | undefined): CacheEntry | null {
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    return null;
  }
  return entry;
}

export function getCachedListingByUrl(url: string): NormalizedEtsyListing | null {
  const normalized = normalizeKey(url);
  const entry = prune(urlCache.get(normalized));
  if (!entry) {
    urlCache.delete(normalized);
    return null;
  }
  return entry.listing;
}

export function getCachedListingById(id: string | null | undefined): NormalizedEtsyListing | null {
  if (!id) {
    return null;
  }
  const entry = prune(idCache.get(normalizeKey(id)));
  if (!entry) {
    idCache.delete(normalizeKey(id));
    return null;
  }
  return entry.listing;
}

export function setCachedListing(listing: NormalizedEtsyListing, ttlMs = DEFAULT_TTL_MS): void {
  const entry: CacheEntry = { listing, expiresAt: Date.now() + ttlMs };
  urlCache.set(normalizeKey(listing.url), entry);
  if (listing.id) {
    idCache.set(normalizeKey(listing.id), entry);
  }
}

export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of urlCache.entries()) {
    if (entry.expiresAt <= now) {
      urlCache.delete(key);
    }
  }
  for (const [key, entry] of idCache.entries()) {
    if (entry.expiresAt <= now) {
      idCache.delete(key);
    }
  }
}
