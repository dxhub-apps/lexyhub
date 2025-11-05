/**
 * Normalized product data across all marketplaces
 */
export interface NormalizedProduct {
  url: string;
  marketplace: string;
  id: string | null;
  title: string | null;
  description: string | null;
  price: {
    amount: number | null;
    currency: string | null;
  };
  images: string[];
  tags: string[];
  category?: string[];
  shop?: {
    id?: string | null;
    name?: string | null;
    url?: string | null;
  };
  extras?: Record<string, unknown>;
  fetchedAt: string;
}

/**
 * Marketplace extractor interface
 */
export interface MarketplaceExtractor {
  /** Name of the marketplace (e.g., 'etsy', 'amazon', 'shopify') */
  readonly name: string;

  /** Check if this extractor can handle the given URL */
  canHandle(url: string): boolean;

  /** Extract product data from the URL */
  extract(url: string): Promise<NormalizedProduct>;
}

/**
 * Product extraction error
 */
export class ProductExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProductExtractionError';
  }
}
