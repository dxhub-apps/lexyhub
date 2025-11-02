import type { NormalizedEtsyListing } from "@/lib/etsy/types";

export type ListingUpsertPayload = {
  marketplace_account_id: string;
  external_listing_id: string;
  title: string | null;
  description: string | null;
  url: string;
  currency: string | null;
  price_cents: number | null;
  quantity: number | null;
  status: string;
  published_at: string | null;
  extras: Record<string, unknown>;
};

export type KeywordUpsertPayload = {
  term: string;
  source: string;
  market: string;
  extras: Record<string, unknown>;
};

export type ListingKeywordPayload = {
  term: string;
  source: string;
};

export type ListingTagPayload = {
  tag: string;
  source: string;
};

export type RawSourcePayload = {
  provider_id: string;
  provider_name: string;
  ingested_at: string;
  payload: unknown;
  metadata: Record<string, unknown>;
};

export type UpsertPayloads = {
  listing: ListingUpsertPayload;
  keywords: KeywordUpsertPayload[];
  listingKeywords: ListingKeywordPayload[];
  listingTags: ListingTagPayload[];
  rawSource: RawSourcePayload;
};

type BuildOptions = {
  marketplaceAccountId: string;
  providerId: string;
  providerName: string;
  featureFlags: string[];
};

function centsFromAmount(amount: number | null): number | null {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return null;
  }
  return Math.round(amount * 100);
}

export function buildUpsertPayloads(
  listing: NormalizedEtsyListing,
  keywords: string[],
  options: BuildOptions,
): UpsertPayloads {
  if (!listing.id) {
    throw new Error("Unable to determine the external Etsy listing identifier");
  }

  const listingPayload: ListingUpsertPayload = {
    marketplace_account_id: options.marketplaceAccountId,
    external_listing_id: listing.id,
    title: listing.title,
    description: listing.description,
    url: listing.url,
    currency: listing.price.currency,
    price_cents: centsFromAmount(listing.price.amount),
    quantity: null,
    status: "active",
    published_at: null,
    extras: {
      source: listing.source,
      fetchedAt: listing.fetchedAt,
      images: listing.images,
      materials: listing.materials,
      tags: listing.tags,
      categoryPath: listing.categoryPath,
      shop: listing.shop,
      reviews: listing.reviews,
      shipping: listing.shipping,
      raw: listing.raw,
      featureFlags: options.featureFlags,
    },
  };

  const keywordPayloads: KeywordUpsertPayload[] = keywords.map((term) => ({
    term,
    source: "etsy_ingest",
    market: "etsy",
    extras: {
      listingId: listing.id,
      provider: options.providerId,
    },
  }));

  const listingKeywordPayloads: ListingKeywordPayload[] = keywords.map((term) => ({
    term,
    source: "etsy_ingest",
  }));

  const listingTagPayloads: ListingTagPayload[] = listing.tags.map((tag) => ({
    tag,
    source: listing.source,
  }));

  const rawSourcePayload: RawSourcePayload = {
    provider_id: options.providerId,
    provider_name: options.providerName,
    ingested_at: new Date().toISOString(),
    payload: {
      listing,
      keywords,
    },
    metadata: {
      featureFlags: options.featureFlags,
    },
  };

  return {
    listing: listingPayload,
    keywords: keywordPayloads,
    listingKeywords: listingKeywordPayloads,
    listingTags: listingTagPayloads,
    rawSource: rawSourcePayload,
  };
}
