import type { MarketplaceExtractor, NormalizedProduct } from "../types";
import { ProductExtractionError } from "../types";

interface ShopifyProductJson {
  id?: number;
  title?: string;
  body_html?: string;
  handle?: string;
  product_type?: string;
  tags?: string | string[];
  variants?: Array<{
    price?: string;
    compare_at_price?: string;
  }>;
  images?: Array<{
    src?: string;
  }>;
  image?: {
    src?: string;
  };
  vendor?: string;
}

/**
 * Shopify product extractor
 * Works with any Shopify-powered store
 */
export class ShopifyExtractor implements MarketplaceExtractor {
  readonly name = "shopify";

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();

      // Check if URL contains /products/ path (common for Shopify)
      if (path.includes("/products/")) {
        return true;
      }

      // Check if domain is known Shopify domain
      const hostname = parsed.hostname.toLowerCase();
      if (hostname.endsWith(".myshopify.com")) {
        return true;
      }

      // We'll try to detect Shopify by making a request in the extract method
      return false;
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<NormalizedProduct> {
    try {
      // Try to fetch the product JSON endpoint
      const jsonUrl = this.buildJsonUrl(url);
      const product = await this.fetchProductJson(jsonUrl);

      if (product) {
        return this.normalizeShopifyProduct(product, url);
      }

      // Fallback to HTML scraping if JSON endpoint doesn't work
      return await this.extractFromHtml(url);
    } catch (error) {
      if (error instanceof ProductExtractionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ProductExtractionError(
          `Failed to extract Shopify product: ${error.message}`,
          "SHOPIFY_EXTRACTION_FAILED",
          { originalError: error.message }
        );
      }
      throw new ProductExtractionError(
        "Failed to extract Shopify product",
        "SHOPIFY_EXTRACTION_FAILED"
      );
    }
  }

  private buildJsonUrl(url: string): string {
    const parsed = new URL(url);

    // Remove query params and hash
    parsed.search = "";
    parsed.hash = "";

    let path = parsed.pathname;

    // If path doesn't end with .json, add it
    if (!path.endsWith(".json")) {
      // Remove trailing slash if present
      path = path.replace(/\/$/, "");
      path = `${path}.json`;
    }

    parsed.pathname = path;
    return parsed.toString();
  }

  private async fetchProductJson(url: string): Promise<ShopifyProductJson | null> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Shopify JSON endpoints return { product: {...} }
      return data.product || data;
    } catch {
      return null;
    }
  }

  private normalizeShopifyProduct(product: ShopifyProductJson, originalUrl: string): NormalizedProduct {
    // Extract price from variants
    let price: number | null = null;
    let currency = "USD"; // Default to USD

    if (product.variants && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      if (firstVariant.price) {
        price = parseFloat(firstVariant.price);
      }
    }

    // Extract images
    const images: string[] = [];
    if (product.image?.src) {
      images.push(product.image.src);
    }
    if (product.images) {
      product.images.forEach((img) => {
        if (img.src && !images.includes(img.src)) {
          images.push(img.src);
        }
      });
    }

    // Extract tags
    const tags: string[] = [];
    if (typeof product.tags === "string") {
      tags.push(
        ...product.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      );
    } else if (Array.isArray(product.tags)) {
      tags.push(...product.tags.filter((t) => typeof t === "string" && t.length > 0));
    }

    // Clean HTML from description
    const description = product.body_html ? this.stripHtml(product.body_html) : null;

    return {
      url: originalUrl,
      marketplace: "shopify",
      id: product.id ? String(product.id) : product.handle || null,
      title: product.title || null,
      description,
      price: {
        amount: price,
        currency,
      },
      images,
      tags,
      category: product.product_type ? [product.product_type] : undefined,
      shop: {
        name: product.vendor || null,
      },
      extras: {
        handle: product.handle,
        variants: product.variants,
      },
      fetchedAt: new Date().toISOString(),
    };
  }

  private async extractFromHtml(url: string): Promise<NormalizedProduct> {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new ProductExtractionError(
        `Failed to fetch Shopify page: ${response.status}`,
        "SHOPIFY_FETCH_FAILED",
        { status: response.status }
      );
    }

    const html = await response.text();

    // Check if this is actually a Shopify store
    if (!html.includes("Shopify") && !html.includes("cdn.shopify.com")) {
      throw new ProductExtractionError(
        "URL does not appear to be a Shopify store",
        "NOT_SHOPIFY",
        { canRetry: false }
      );
    }

    // Extract from meta tags
    const title = this.extractMeta(html, "og:title") || this.extractMeta(html, "twitter:title");
    const description = this.extractMeta(html, "og:description") || this.extractMeta(html, "twitter:description");
    const imageUrl = this.extractMeta(html, "og:image") || this.extractMeta(html, "twitter:image");
    const priceAmount = this.extractMeta(html, "og:price:amount") || this.extractMeta(html, "product:price:amount");
    const priceCurrency =
      this.extractMeta(html, "og:price:currency") || this.extractMeta(html, "product:price:currency") || "USD";

    // Try to extract JSON-LD
    const jsonLd = this.extractJsonLd(html);
    const productJsonLd = jsonLd.find((item: any) => item["@type"] === "Product");

    const images: string[] = [];
    if (imageUrl) images.push(imageUrl);

    // Extract more images from JSON-LD if available
    if (productJsonLd?.image) {
      if (Array.isArray(productJsonLd.image)) {
        images.push(...productJsonLd.image);
      } else if (typeof productJsonLd.image === "string") {
        images.push(productJsonLd.image);
      }
    }

    return {
      url,
      marketplace: "shopify",
      id: null,
      title,
      description,
      price: {
        amount: priceAmount ? parseFloat(priceAmount) : null,
        currency: priceCurrency,
      },
      images: Array.from(new Set(images)),
      tags: [],
      extras: {
        jsonLd: productJsonLd,
      },
      fetchedAt: new Date().toISOString(),
    };
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

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  private escapeRegex(str: string): string {
    return str.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }
}
