import { ScrapeEtsyProvider } from "../../etsy/providers/scrape-provider";
import type { MarketplaceExtractor, NormalizedProduct } from "../types";
import { ProductExtractionError } from "../types";

/**
 * Etsy product extractor
 */
export class EtsyExtractor implements MarketplaceExtractor {
  readonly name = "etsy";
  private provider = new ScrapeEtsyProvider();

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return hostname === "etsy.com" || hostname.endsWith(".etsy.com");
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<NormalizedProduct> {
    try {
      const listing = await this.provider.getListingByUrl(url);

      return {
        url: listing.url,
        marketplace: "etsy",
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: {
          amount: listing.price.amount,
          currency: listing.price.currency,
        },
        images: listing.images,
        tags: listing.tags,
        category: listing.categoryPath,
        shop: {
          id: listing.shop.id,
          name: listing.shop.name,
          url: listing.shop.url,
        },
        extras: {
          materials: listing.materials,
          reviews: listing.reviews,
          shipping: listing.shipping,
        },
        fetchedAt: listing.fetchedAt,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ProductExtractionError(
          `Failed to extract Etsy product: ${error.message}`,
          "ETSY_EXTRACTION_FAILED",
          { originalError: error.message }
        );
      }
      throw new ProductExtractionError(
        "Failed to extract Etsy product",
        "ETSY_EXTRACTION_FAILED"
      );
    }
  }
}
