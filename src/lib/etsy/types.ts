export type NormalizedEtsyPrice = {
  amount: number | null;
  currency: string | null;
};

export type NormalizedEtsyShop = {
  id: string | null;
  name: string | null;
  url: string | null;
  location: string | null;
};

export type NormalizedEtsyReviews = {
  count: number | null;
  rating: number | null;
};

export type NormalizedEtsyShipping = {
  freeShipping: boolean | null;
  shipsFrom: string | null;
  processingTime: string | null;
};

export type NormalizedEtsyListing = {
  id: string | null;
  url: string;
  title: string | null;
  description: string | null;
  price: NormalizedEtsyPrice;
  images: string[];
  tags: string[];
  materials: string[];
  categoryPath: string[];
  shop: NormalizedEtsyShop;
  reviews: NormalizedEtsyReviews;
  shipping: NormalizedEtsyShipping;
  raw: unknown;
  fetchedAt: string;
  source: "scrape" | "api";
};

export type SearchOptions = {
  limit?: number;
  page?: number;
  shopId?: string;
  strategy?: "keyword" | "best-sellers";
  category?: string;
};

export type EtsyProviderErrorType =
  | "INVALID_URL"
  | "NOT_FOUND"
  | "FETCH_FAILED"
  | "BLOCKED"
  | "CONFIGURATION"
  | "UNKNOWN";

export class EtsyProviderError extends Error {
  readonly type: EtsyProviderErrorType;

  readonly status?: number;

  readonly canRetry: boolean;

  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    type: EtsyProviderErrorType,
    options: { status?: number; canRetry?: boolean; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "EtsyProviderError";
    this.type = type;
    this.status = options.status;
    this.canRetry = options.canRetry ?? false;
    this.details = options.details;
  }
}

export function isEtsyProviderError(error: unknown): error is EtsyProviderError {
  return error instanceof EtsyProviderError;
}
