import type { EtsyProvider } from "./provider";
import {
  EtsyProviderError,
  type NormalizedEtsyListing,
  type NormalizedEtsyShop,
  type SearchOptions,
} from "../types";

const REQUIRED_ENV = ["ETSY_API_KEY", "ETSY_API_SECRET", "ETSY_BASE_URL"] as const;

type EtsyApiConfig = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
};

function readConfig(): EtsyApiConfig {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new EtsyProviderError(
      `Missing Etsy API configuration: ${missing.join(", ")}`,
      "CONFIGURATION",
      { canRetry: false },
    );
  }
  return {
    apiKey: process.env.ETSY_API_KEY as string,
    apiSecret: process.env.ETSY_API_SECRET as string,
    baseUrl: process.env.ETSY_BASE_URL as string,
  };
}

function stubListing(url: string, rawOverrides: Record<string, unknown> = {}): NormalizedEtsyListing {
  return {
    id: null,
    url,
    title: null,
    description: null,
    price: { amount: null, currency: null },
    images: [],
    tags: [],
    materials: [],
    categoryPath: [],
    shop: { id: null, name: null, url: null, location: null },
    reviews: { count: null, rating: null },
    shipping: { freeShipping: null, shipsFrom: null, processingTime: null },
    raw: {
      message: "Etsy API provider not implemented",
      plannedMapping: {
        listingEndpoint: "/listings/{listing_id}",
        shopEndpoint: "/shops/{shop_id}",
        imagesEndpoint: "/listings/{listing_id}/images",
        reviewsEndpoint: "/listings/{listing_id}/reviews",
      },
      ...rawOverrides,
    },
    fetchedAt: new Date().toISOString(),
    source: "api",
  };
}

export class ApiEtsyProvider implements EtsyProvider {
  async getListingByUrl(url: string): Promise<NormalizedEtsyListing> {
    try {
      readConfig();
    } catch (error) {
      if (error instanceof EtsyProviderError) {
        throw error;
      }
      throw new EtsyProviderError(
        error instanceof Error ? error.message : "Invalid Etsy API configuration",
        "CONFIGURATION",
        { canRetry: false },
      );
    }

    return stubListing(url);
  }

  async getShopByUrl(_url: string): Promise<NormalizedEtsyShop> {
    throw new EtsyProviderError("Shop lookup not implemented", "UNKNOWN", { canRetry: false });
  }

  async search(_query: string, options?: SearchOptions): Promise<NormalizedEtsyListing[]> {
    try {
      readConfig();
    } catch (error) {
      if (error instanceof EtsyProviderError) {
        throw error;
      }
      throw new EtsyProviderError(
        error instanceof Error ? error.message : "Invalid Etsy API configuration",
        "CONFIGURATION",
        { canRetry: false },
      );
    }

    if (options?.strategy && options.strategy !== "best-sellers") {
      throw new EtsyProviderError("Search strategy not implemented", "UNKNOWN", { canRetry: false });
    }

    const limit = Math.max(1, Math.min(options?.limit ?? 1, 20));
    const category = options?.category ?? "c/best-selling-items";
    const url = /^https?:/i.test(category)
      ? category
      : `https://www.etsy.com/${category.replace(/^\/+/, "")}`;

    const plannedEndpoint =
      "GET /v3/application/shops/{shop_id}/listings?sort_on=score&sort_order=down&limit={limit}";

    return Array.from({ length: limit }, () =>
      stubListing(url, {
        plannedSearchStrategy: "best-sellers",
        plannedEndpoint,
        note: "Awaiting Etsy API integration to surface official best seller feed",
      }),
    );
  }
}
