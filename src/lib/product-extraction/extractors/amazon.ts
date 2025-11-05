import type { MarketplaceExtractor, NormalizedProduct } from "../types";
import { ProductExtractionError } from "../types";

/**
 * Amazon product extractor
 * Extracts product data from Amazon listing pages
 */
export class AmazonExtractor implements MarketplaceExtractor {
  readonly name = "amazon";

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      return (
        hostname === "amazon.com" ||
        hostname.endsWith(".amazon.com") ||
        /amazon\.(co\.uk|ca|de|fr|es|it|co\.jp|in|com\.mx|com\.br|com\.au|nl|se|pl|sg)$/i.test(hostname)
      );
    } catch {
      return false;
    }
  }

  async extract(url: string): Promise<NormalizedProduct> {
    try {
      const normalizedUrl = this.normalizeAmazonUrl(url);
      const asin = this.extractAsin(normalizedUrl);

      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!response.ok) {
        throw new ProductExtractionError(
          `Amazon returned status ${response.status}`,
          "AMAZON_FETCH_FAILED",
          { status: response.status }
        );
      }

      const html = await response.text();

      // Check if we hit a CAPTCHA or robot check
      if (html.includes("api-services-support@amazon.com") || html.includes("Robot Check")) {
        throw new ProductExtractionError(
          "Amazon blocked the request with CAPTCHA",
          "AMAZON_CAPTCHA",
          { canRetry: true }
        );
      }

      const product = this.parseAmazonHtml(html, normalizedUrl, asin);
      return product;
    } catch (error) {
      if (error instanceof ProductExtractionError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new ProductExtractionError(
          `Failed to extract Amazon product: ${error.message}`,
          "AMAZON_EXTRACTION_FAILED",
          { originalError: error.message }
        );
      }
      throw new ProductExtractionError(
        "Failed to extract Amazon product",
        "AMAZON_EXTRACTION_FAILED"
      );
    }
  }

  private normalizeAmazonUrl(url: string): string {
    const parsed = new URL(url);
    // Keep only the essential path and remove tracking parameters
    const asin = this.extractAsin(url);
    if (asin) {
      return `${parsed.protocol}//${parsed.hostname}/dp/${asin}`;
    }
    return url;
  }

  private extractAsin(url: string): string | null {
    // ASIN is typically in /dp/ or /gp/product/ paths
    const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return match ? match[1] : null;
  }

  private parseAmazonHtml(html: string, url: string, asin: string | null): NormalizedProduct {
    // Extract JSON-LD data
    const jsonLd = this.extractJsonLd(html);

    // Extract from meta tags
    const title = this.extractMeta(html, "og:title") || this.extractFromSelector(html, "#productTitle");
    const description =
      this.extractMeta(html, "og:description") ||
      this.extractFromSelector(html, "#feature-bullets") ||
      this.extractFromSelector(html, "#productDescription");
    const imageUrl = this.extractMeta(html, "og:image");

    // Extract price - Amazon has complex pricing
    const price = this.extractPrice(html);

    // Extract additional images
    const images = this.extractImages(html, imageUrl);

    // Extract category/tags from breadcrumbs or features
    const tags = this.extractTags(html);
    const category = this.extractCategory(html);

    return {
      url,
      marketplace: "amazon",
      id: asin,
      title: this.cleanText(title),
      description: this.cleanText(description),
      price,
      images,
      tags,
      category,
      extras: {
        jsonLd: jsonLd.length > 0 ? jsonLd : undefined,
      },
      fetchedAt: new Date().toISOString(),
    };
  }

  private extractJsonLd(html: string): unknown[] {
    const scripts = Array.from(html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi));
    const payloads: unknown[] = [];

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
    const regex = new RegExp(
      `<meta[^>]+property=["']${property.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}["'][^>]+content=["']([^"']+)["']`,
      "i"
    );
    const match = html.match(regex);
    return match?.[1] || null;
  }

  private extractFromSelector(html: string, selector: string): string | null {
    // Simple extraction based on common Amazon selectors
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const regex = new RegExp(`<[^>]+id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, "i");
    const match = html.match(regex);

    if (match && match[1]) {
      // Strip HTML tags
      return match[1].replace(/<[^>]+>/g, " ").trim();
    }

    return null;
  }

  private extractPrice(html: string): { amount: number | null; currency: string | null } {
    // Try multiple price selectors
    const pricePatterns = [
      /"priceAmount":([0-9.]+)/,
      /"price":([0-9.]+)/,
      /\$([0-9]+\.[0-9]{2})/,
      /<span[^>]*class="[^"]*a-price-whole[^"]*"[^>]*>([0-9,]+)<\/span>/,
    ];

    let amount: number | null = null;
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const parsed = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(parsed)) {
          amount = parsed;
          break;
        }
      }
    }

    // Extract currency from meta or default to USD
    const currencyMatch = html.match(/"currencyCode":"([A-Z]{3})"/);
    const currency = currencyMatch ? currencyMatch[1] : "USD";

    return { amount, currency };
  }

  private extractImages(html: string, primaryImage: string | null): string[] {
    const images = new Set<string>();

    if (primaryImage) {
      images.add(primaryImage);
    }

    // Try to extract from image data
    const imageMatches = html.matchAll(/"hiRes":"([^"]+)"/g);
    for (const match of imageMatches) {
      if (match[1]) images.add(match[1]);
    }

    // Alternative image pattern
    const altImageMatches = html.matchAll(/"large":"([^"]+)"/g);
    for (const match of altImageMatches) {
      if (match[1]) images.add(match[1]);
    }

    return Array.from(images);
  }

  private extractTags(html: string): string[] {
    const tags = new Set<string>();

    // Extract from keywords meta tag
    const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
    if (keywordsMatch && keywordsMatch[1]) {
      keywordsMatch[1]
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
        .forEach((k) => tags.add(k));
    }

    return Array.from(tags);
  }

  private extractCategory(html: string): string[] {
    const categories: string[] = [];

    // Extract from breadcrumbs
    const breadcrumbMatches = html.matchAll(/<a[^>]+class="[^"]*a-link-normal[^"]*"[^>]*>([^<]+)<\/a>/g);
    for (const match of breadcrumbMatches) {
      const text = this.cleanText(match[1]);
      if (text && text.length > 0 && text.length < 100) {
        categories.push(text);
      }
    }

    return categories.slice(0, 5); // Limit to first 5
  }

  private cleanText(text: string | null): string | null {
    if (!text) return null;
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }
}
