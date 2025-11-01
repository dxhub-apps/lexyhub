import type { NormalizedEtsyListing, NormalizedEtsyShop, SearchOptions } from "../types";

export interface EtsyProvider {
  getListingByUrl(url: string): Promise<NormalizedEtsyListing>;
  getShopByUrl?(url: string): Promise<NormalizedEtsyShop>;
  search?(query: string, options?: SearchOptions): Promise<NormalizedEtsyListing[]>;
}
