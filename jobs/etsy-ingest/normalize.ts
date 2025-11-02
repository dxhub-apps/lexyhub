import type { NormalizedEtsyListing, NormalizedEtsyShop } from "@/lib/etsy/types";

type MergeOptions = {
  shop?: NormalizedEtsyShop | null;
};

function deriveListingIdFromUrl(url: string): string | null {
  const match = /\/listing\/(\d+)/.exec(url);
  if (match) {
    return match[1];
  }
  return null;
}

function mergeShop(listing: NormalizedEtsyListing, shop?: NormalizedEtsyShop | null): NormalizedEtsyListing {
  if (!shop) {
    return listing;
  }

  return {
    ...listing,
    shop: {
      id: shop.id ?? listing.shop.id ?? null,
      name: shop.name ?? listing.shop.name ?? null,
      url: shop.url ?? listing.shop.url ?? null,
      location: shop.location ?? listing.shop.location ?? null,
    },
  };
}

export function normalizeListing(
  listing: NormalizedEtsyListing,
  options: MergeOptions = {},
): NormalizedEtsyListing {
  const merged = mergeShop(listing, options.shop);
  const derivedId = merged.id ?? deriveListingIdFromUrl(merged.url);

  return {
    ...merged,
    id: derivedId,
    fetchedAt: merged.fetchedAt ?? new Date().toISOString(),
    tags: Array.from(new Set(merged.tags.map((tag) => tag.trim()).filter(Boolean))),
    materials: Array.from(new Set(merged.materials.map((material) => material.trim()).filter(Boolean))),
    categoryPath: merged.categoryPath.filter(Boolean),
  };
}
