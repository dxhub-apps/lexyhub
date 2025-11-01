import { describe, expect, it } from "vitest";

import { buildListingReferers, extractListingContext } from "../etsy/providers/scrape-provider";

const SAMPLE_URL = "https://www.etsy.com/listing/945529830/personalized-leather-journal-notebook";

describe("extractListingContext", () => {
  it("pulls the listing id and slug from canonical listing urls", () => {
    const context = extractListingContext(SAMPLE_URL);
    expect(context).toEqual({ id: "945529830", slug: "personalized-leather-journal-notebook" });
  });

  it("gracefully handles urls without a slug", () => {
    const context = extractListingContext("https://www.etsy.com/listing/945529830");
    expect(context).toEqual({ id: "945529830", slug: null });
  });

  it("returns nulls for non-listing urls", () => {
    const context = extractListingContext("https://www.etsy.com/shop/test");
    expect(context).toEqual({ id: null, slug: null });
  });
});

describe("buildListingReferers", () => {
  it("includes a mix of homepage, listing, search, and category referers", () => {
    const referers = buildListingReferers(SAMPLE_URL);
    expect(referers).toContain("https://www.etsy.com/");
    expect(referers).toContain("https://www.etsy.com/listing/945529830");
    expect(referers).toContain(
      "https://www.etsy.com/search?q=personalized%20leather%20journal%20notebook",
    );
    expect(referers).toContain("https://www.etsy.com/c/best-selling-items");
  });

  it("deduplicates referers even if the slug is missing", () => {
    const referers = buildListingReferers("https://www.etsy.com/listing/123456789/");
    expect(new Set(referers).size).toBe(referers.length);
  });
});
