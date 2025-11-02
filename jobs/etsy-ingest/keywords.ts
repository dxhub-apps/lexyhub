import { keywordExtractionService } from "@/lib/etsy/pipelines";
import type { NormalizedEtsyListing } from "@/lib/etsy/types";

export async function extractListingKeywords(
  listing: NormalizedEtsyListing,
  enabled: boolean,
): Promise<string[]> {
  if (!enabled) {
    return [];
  }

  const { keywords } = await keywordExtractionService.run(listing);
  return keywords.map((keyword) => keyword.trim()).filter(Boolean);
}
