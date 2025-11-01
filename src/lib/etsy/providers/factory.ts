import { ApiEtsyProvider } from "./api-provider";
import type { EtsyProvider } from "./provider";
import { ScrapeEtsyProvider } from "./scrape-provider";
import { EtsyProviderError, isEtsyProviderError, type SearchOptions } from "../types";

class FallbackEtsyProvider implements EtsyProvider {
  constructor(private readonly primary: EtsyProvider, private readonly fallback: EtsyProvider) {}

  async getListingByUrl(url: string) {
    try {
      return await this.primary.getListingByUrl(url);
    } catch (error) {
      console.warn(
        JSON.stringify({
          method: "EtsyProviderFactory.getListingByUrl",
          provider: "api",
          fallback: true,
          to: "scrape",
          url,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      if (isEtsyProviderError(error) && error.type === "CONFIGURATION") {
        // fall through to scrape provider without throwing
      }
      return this.fallback.getListingByUrl(url);
    }
  }

  async getShopByUrl(url: string) {
    if (typeof this.primary.getShopByUrl === "function") {
      try {
        return await this.primary.getShopByUrl(url);
      } catch (error) {
        console.warn(
          JSON.stringify({
            method: "EtsyProviderFactory.getShopByUrl",
            provider: "api",
            fallback: true,
            to: "scrape",
            url,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    if (typeof this.fallback.getShopByUrl === "function") {
      return this.fallback.getShopByUrl(url);
    }
    throw new EtsyProviderError("Shop lookup not supported", "UNKNOWN", { canRetry: false });
  }

  async search(query: string, options?: SearchOptions) {
    if (typeof this.primary.search === "function") {
      try {
        return await this.primary.search(query, options);
      } catch (error) {
        console.warn(
          JSON.stringify({
            method: "EtsyProviderFactory.search",
            provider: "api",
            fallback: true,
            to: "scrape",
            query,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    if (typeof this.fallback.search === "function") {
      return this.fallback.search(query, options);
    }
    throw new EtsyProviderError("Search not supported", "UNKNOWN", { canRetry: false });
  }
}

function resolveSource(): "SCRAPE" | "API" {
  const source = (process.env.ETSY_DATA_SOURCE ?? "SCRAPE").toUpperCase();
  return source === "API" ? "API" : "SCRAPE";
}

export class EtsyProviderFactory {
  static get(): EtsyProvider {
    const source = resolveSource();
    if (source === "API") {
      return new FallbackEtsyProvider(new ApiEtsyProvider(), new ScrapeEtsyProvider());
    }
    return new ScrapeEtsyProvider();
  }
}
