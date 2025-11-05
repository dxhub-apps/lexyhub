import type { MarketplaceExtractor, NormalizedProduct } from "./types";
import { ProductExtractionError } from "./types";
import { EtsyExtractor } from "./extractors/etsy";
import { AmazonExtractor } from "./extractors/amazon";
import { ShopifyExtractor } from "./extractors/shopify";
import { EbayExtractor } from "./extractors/ebay";
import { GenericExtractor } from "./extractors/generic";

/**
 * Product extraction service
 * Routes URLs to appropriate marketplace extractors
 */
export class ProductExtractionService {
  private extractors: MarketplaceExtractor[];
  private genericExtractor: GenericExtractor;

  constructor() {
    this.extractors = [
      new EtsyExtractor(),
      new AmazonExtractor(),
      new ShopifyExtractor(),
      new EbayExtractor(),
    ];
    this.genericExtractor = new GenericExtractor();
  }

  /**
   * Detect which marketplace a URL belongs to
   */
  detectMarketplace(url: string): string | null {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

      // Check each extractor
      for (const extractor of this.extractors) {
        if (extractor.canHandle(url)) {
          return extractor.name;
        }
      }

      // Try to infer from hostname
      if (hostname === "etsy.com" || hostname.endsWith(".etsy.com")) {
        return "etsy";
      }
      if (hostname === "amazon.com" || hostname.includes("amazon.")) {
        return "amazon";
      }
      if (hostname.endsWith(".myshopify.com") || parsed.pathname.includes("/products/")) {
        return "shopify";
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract product data from a URL
   */
  async extract(url: string): Promise<NormalizedProduct> {
    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ProductExtractionError("Invalid URL", "INVALID_URL", { url });
    }

    // Find appropriate extractor
    const extractor = this.extractors.find((e) => e.canHandle(url));

    // If no specific extractor found, try generic extractor
    if (!extractor) {
      console.log(`No specific extractor found for ${parsed.hostname}, trying generic extraction`);
      try {
        const product = await this.genericExtractor.extract(url);

        // Validate extracted product
        if (!product.title && !product.description && !product.price.amount) {
          throw new ProductExtractionError(
            "Could not extract meaningful product data from URL",
            "INSUFFICIENT_DATA",
            { url, marketplace: "generic" }
          );
        }

        return product;
      } catch (error) {
        const marketplace = this.detectMarketplace(url);
        throw new ProductExtractionError(
          marketplace
            ? `${marketplace} extraction is not yet fully supported`
            : "Could not extract product data. Supported marketplaces: Etsy, Amazon, Shopify, eBay",
          "UNSUPPORTED_MARKETPLACE",
          { url, hostname: parsed.hostname, detectedMarketplace: marketplace }
        );
      }
    }

    // Extract product using specific extractor
    try {
      const product = await extractor.extract(url);

      // Validate extracted product
      if (!product.title && !product.description && !product.price.amount) {
        throw new ProductExtractionError(
          "Could not extract meaningful product data from URL",
          "INSUFFICIENT_DATA",
          { url, marketplace: extractor.name }
        );
      }

      return product;
    } catch (error) {
      if (error instanceof ProductExtractionError) {
        throw error;
      }

      throw new ProductExtractionError(
        `Failed to extract product from ${extractor.name}`,
        "EXTRACTION_FAILED",
        {
          marketplace: extractor.name,
          url,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Check if a URL is supported
   */
  isSupported(url: string): boolean {
    try {
      return this.extractors.some((e) => e.canHandle(url));
    } catch {
      return false;
    }
  }

  /**
   * Get list of supported marketplaces
   */
  getSupportedMarketplaces(): string[] {
    return this.extractors.map((e) => e.name);
  }
}

// Export singleton instance
export const productExtractionService = new ProductExtractionService();
