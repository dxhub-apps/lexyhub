import type { MarketplaceExtractor, NormalizedProduct } from "../types";
import { ProductExtractionError } from "../types";

/**
 * eBay product extractor
 * Extracts product data from eBay listing pages
 */
export class EbayExtractor implements MarketplaceExtractor {
  readonly name = "ebay";

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return (
        hostname === "ebay.com" ||
        hostname.endsWith(".ebay.com") ||
        /ebay\.(co\.uk|ca|de|fr|es|it|com\.au|ie)$/i.test(hostname)
      );
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<NormalizedProduct> {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        throw new ProductExtractionError(
          `eBay returned status ${response.status}`,
          "EBAY_FETCH_FAILED",
          { status: response.status }
        );
      }

      const html = await response.text();
      const product = this.parseEbayHtml(html, url);
      return product;
    } catch (error) {
      if (error instanceof ProductExtractionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ProductExtractionError(
          `Failed to extract eBay product: ${error.message}`,
          "EBAY_EXTRACTION_FAILED",
          { originalError: error.message }
        );
      }
      throw new ProductExtractionError("Failed to extract eBay product", "EBAY_EXTRACTION_FAILED");
    }
  }

  private parseEbayHtml(html: string, url: string): NormalizedProduct {
    // Extract JSON-LD data
    const jsonLd = this.extractJsonLd(html);
    const productJsonLd = jsonLd.find((item: any) => item["@type"] === "Product");

    // Extract from meta tags
    const title = this.extractMeta(html, "og:title") || this.extractMeta(html, "twitter:title");
    const description = this.extractMeta(html, "og:description") || this.extractMeta(html, "twitter:description");
    const imageUrl = this.extractMeta(html, "og:image") || this.extractMeta(html, "twitter:image");

    // Extract price
    let price: number | null = null;
    let currency = "USD";

    if (productJsonLd?.offers) {
      const offer = Array.isArray(productJsonLd.offers) ? productJsonLd.offers[0] : productJsonLd.offers;
      if (offer?.price) {
        price = typeof offer.price === "number" ? offer.price : parseFloat(offer.price);
      }
      if (offer?.priceCurrency) {
        currency = offer.priceCurrency;
      }
    }

    // Fallback price extraction from HTML
    if (price === null) {
      const priceMatch = html.match(/["']priceCurrency["']:\s*["']([A-Z]{3})["'],\s*["']price["']:\s*["']?([0-9.]+)["']?/);
      if (priceMatch) {
        currency = priceMatch[1];
        price = parseFloat(priceMatch[2]);
      }
    }

    // Extract item ID from URL
    const itemIdMatch = url.match(/\/itm\/(\d+)/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;

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

    // Extract seller info
    const seller = productJsonLd?.seller || productJsonLd?.brand;
    const shop = seller
      ? {
          name: seller.name || null,
          url: seller.url || null,
        }
      : undefined;

    return {
      url,
      marketplace: "ebay",
      id: itemId,
      title,
      description,
      price: {
        amount: price,
        currency,
      },
      images: Array.from(new Set(images)),
      tags: [],
      category,
      shop,
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
