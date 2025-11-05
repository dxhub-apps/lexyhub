import type { MarketplaceExtractor, NormalizedProduct } from "../types";
import { ProductExtractionError } from "../types";

/**
 * Generic product extractor
 * Attempts to extract product data from any URL using meta tags and JSON-LD
 * This is a fallback extractor for unsupported marketplaces
 */
export class GenericExtractor implements MarketplaceExtractor {
  readonly name = "generic";

  canHandle(_url: string): boolean {
    // Always returns false - this should be used as a fallback
    return false;
  }

  async extract(url: string): Promise<NormalizedProduct> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new ProductExtractionError(
          `Failed to fetch page: ${response.status}`,
          "GENERIC_FETCH_FAILED",
          { status: response.status }
        );
      }

      const html = await response.text();
      const product = this.parseHtml(html, url);
      return product;
    } catch (error) {
      if (error instanceof ProductExtractionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ProductExtractionError(
          `Failed to extract product: ${error.message}`,
          "GENERIC_EXTRACTION_FAILED",
          { originalError: error.message }
        );
      }
      throw new ProductExtractionError("Failed to extract product", "GENERIC_EXTRACTION_FAILED");
    }
  }

  private parseHtml(html: string, url: string): NormalizedProduct {
    // Extract JSON-LD data
    const jsonLd = this.extractJsonLd(html);
    const productJsonLd = jsonLd.find((item: any) => item["@type"] === "Product");

    // Extract from meta tags
    const title =
      this.extractMeta(html, "og:title") ||
      this.extractMeta(html, "twitter:title") ||
      this.extractMeta(html, "title");

    const description =
      this.extractMeta(html, "og:description") ||
      this.extractMeta(html, "twitter:description") ||
      this.extractMeta(html, "description");

    const imageUrl = this.extractMeta(html, "og:image") || this.extractMeta(html, "twitter:image");

    // Extract price from various sources
    let price: number | null = null;
    let currency = "USD";

    // Try JSON-LD first
    if (productJsonLd?.offers) {
      const offer = Array.isArray(productJsonLd.offers) ? productJsonLd.offers[0] : productJsonLd.offers;
      if (offer?.price) {
        price = typeof offer.price === "number" ? offer.price : parseFloat(offer.price);
      }
      if (offer?.priceCurrency) {
        currency = offer.priceCurrency;
      }
    }

    // Try meta tags
    if (price === null) {
      const priceAmount =
        this.extractMeta(html, "product:price:amount") || this.extractMeta(html, "og:price:amount");
      const priceCurrency =
        this.extractMeta(html, "product:price:currency") || this.extractMeta(html, "og:price:currency");

      if (priceAmount) {
        price = parseFloat(priceAmount);
      }
      if (priceCurrency) {
        currency = priceCurrency;
      }
    }

    // Extract images
    const images: string[] = [];
    if (imageUrl) images.push(imageUrl);

    if (productJsonLd?.image) {
      if (Array.isArray(productJsonLd.image)) {
        images.push(...productJsonLd.image);
      } else if (typeof productJsonLd.image === "string") {
        images.push(productJsonLd.image);
      }
    }

    // Extract category
    const category: string[] = [];
    if (productJsonLd?.category) {
      if (Array.isArray(productJsonLd.category)) {
        category.push(...productJsonLd.category);
      } else if (typeof productJsonLd.category === "string") {
        category.push(productJsonLd.category);
      }
    }

    // Extract tags/keywords
    const tags: string[] = [];
    const keywords = this.extractMeta(html, "keywords");
    if (keywords) {
      tags.push(
        ...keywords
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
      );
    }

    // Detect marketplace from URL
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const marketplace = hostname.split(".")[0] || "unknown";

    return {
      url,
      marketplace,
      id: productJsonLd?.sku || productJsonLd?.productID || null,
      title,
      description,
      price: {
        amount: price,
        currency,
      },
      images: Array.from(new Set(images)),
      tags,
      category,
      extras: {
        jsonLd: productJsonLd,
      },
      fetchedAt: new Date().toISOString(),
    };
  }

  private extractJsonLd(html: string): any[] {
    const scripts = Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
    const payloads: any[] = [];

    for (const [, raw] of scripts) {
      try {
        if (!raw) continue;
        const parsed = JSON.parse(raw.trim());
        if (Array.isArray(parsed)) {
          payloads.push(...parsed);
        } else {
          payloads.push(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return payloads;
  }

  private extractMeta(html: string, property: string): string | null {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${this.escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${this.escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${this.escapeRegex(property)}["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${this.escapeRegex(property)}["']`, "i"),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }

    return null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }
}
