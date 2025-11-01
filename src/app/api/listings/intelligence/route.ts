import { NextRequest, NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

import { analyzeListing, type ListingInput } from "@/lib/listings/intelligence";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { EtsyProviderFactory } from "@/lib/etsy/providers/factory";
import {
  aiSuggestionService,
  difficultyScoringService,
  keywordExtractionService,
  type AiSuggestionResult,
  type DifficultyScoreResult,
  type KeywordExtractionResult,
} from "@/lib/etsy/pipelines";
import {
  clearExpiredCache,
  getCachedListingById,
  getCachedListingByUrl,
  setCachedListing,
} from "@/lib/etsy/cache";
import { isEtsyProviderError, type NormalizedEtsyListing } from "@/lib/etsy/types";

type ListingPayload = {
  listingId?: string;
  listing?: ListingInput;
  listingUrl?: string;
  ingestionMode?: "manual" | "best-sellers";
  bestSellerCategory?: string;
  bestSellerLimit?: number;
};

type SupabaseListingRow = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  currency: string | null;
  extras: Record<string, unknown> | null;
};

type SupabaseTagRow = {
  tag: string | null;
};

function mapListing(row: SupabaseListingRow, tags: SupabaseTagRow[]): ListingInput {
  const extras = (row.extras ?? {}) as Record<string, unknown>;
  const materials = Array.isArray(extras.materials)
    ? (extras.materials as string[])
    : typeof extras.material === "string"
    ? String(extras.material).split(",")
    : [];
  const categories = Array.isArray(extras.categories)
    ? (extras.categories as string[])
    : typeof extras.category_path === "string"
    ? String(extras.category_path).split(">")
    : [];
  const attributes = typeof extras.attributes === "object" && extras.attributes !== null ? (extras.attributes as Record<string, string | null>) : undefined;
  const reviews = Number(extras.reviews ?? extras.review_count ?? extras.total_reviews ?? 0) || null;
  const rating = Number(extras.rating ?? extras.average_rating ?? extras.star_rating ?? 0) || null;
  const salesVolume = Number(extras.sales_volume ?? extras.total_sales ?? extras.orders ?? 0) || null;

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    priceCents: row.price_cents,
    currency: row.currency,
    tags: tags.map((tag) => tag.tag ?? "").filter(Boolean),
    materials,
    categories,
    attributes,
    reviews,
    rating,
    salesVolume,
  };
}

function extractListingIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = /listing\/(\d+)/.exec(parsed.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function convertToListingInput(listing: NormalizedEtsyListing): ListingInput {
  return {
    id: listing.id ?? undefined,
    title: listing.title ?? "Untitled listing",
    description: listing.description ?? undefined,
    tags: listing.tags,
    materials: listing.materials,
    categories: listing.categoryPath,
    priceCents: listing.price.amount != null ? Math.round(listing.price.amount * 100) : null,
    currency: listing.price.currency,
    reviews: listing.reviews.count,
    rating: listing.reviews.rating,
    salesVolume: null,
  };
}

function countExtractedFields(listing: NormalizedEtsyListing): number {
  let count = 0;
  if (listing.id) count += 1;
  if (listing.title) count += 1;
  if (listing.description) count += 1;
  if (listing.price.amount != null) count += 1;
  if (listing.price.currency) count += 1;
  if (listing.images.length) count += 1;
  if (listing.tags.length) count += 1;
  if (listing.materials.length) count += 1;
  if (listing.categoryPath.length) count += 1;
  if (listing.shop.name) count += 1;
  if (listing.reviews.count != null || listing.reviews.rating != null) count += 1;
  if (listing.shipping.freeShipping != null || listing.shipping.shipsFrom || listing.shipping.processingTime) count += 1;
  return count;
}

type ProviderErrorResponse = {
  error: string;
  type: string;
  canRetry: boolean;
  status: number;
};

function mapProviderError(error: unknown): ProviderErrorResponse | null {
  if (!isEtsyProviderError(error)) {
    return null;
  }
  const status = (() => {
    switch (error.type) {
      case "NOT_FOUND":
        return 404;
      case "BLOCKED":
        return 429;
      case "FETCH_FAILED":
        return 503;
      case "CONFIGURATION":
        return 503;
      default:
        return 500;
    }
  })();
  return {
    error: error.message,
    type: error.type,
    canRetry: error.canRetry,
    status,
  } satisfies ProviderErrorResponse;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json().catch(() => ({}))) as ListingPayload;
  clearExpiredCache();

  let listing: ListingInput | undefined = payload.listing;
  let listingId: string | undefined = payload.listingId ?? payload.listing?.id;
  let normalizedListing: NormalizedEtsyListing | null = null;
  let ingestionFromCache = false;
  let ingestionMode: "manual" | "url" | "best-sellers" | "synced" = "manual";

  if (payload.listingId) {
    ingestionMode = "synced";
  } else if (payload.ingestionMode === "best-sellers") {
    ingestionMode = "best-sellers";
  } else if (payload.listingUrl) {
    ingestionMode = "url";
  }

  const supabase = getSupabaseServerClient();
  if (!listing && payload.listingId) {
    if (!supabase) {
      return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
    }
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, description, price_cents, currency, extras")
      .eq("id", payload.listingId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Unable to load listing: ${error.message}` }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const { data: tagsData, error: tagsError } = await supabase
      .from("listing_tags")
      .select("tag")
      .eq("listing_id", data.id);

    if (tagsError) {
      return NextResponse.json({ error: `Unable to load tags: ${tagsError.message}` }, { status: 500 });
    }

    listing = mapListing(data as SupabaseListingRow, (tagsData ?? []) as SupabaseTagRow[]);
    listingId = data.id;
  }

  if (payload.ingestionMode === "best-sellers" && !listing && !payload.listingId) {
    const startedAt = Date.now();
    const provider = EtsyProviderFactory.get();
    if (typeof provider.search !== "function") {
      return NextResponse.json({ error: "Etsy search is unavailable" }, { status: 503 });
    }

    const limit = Number.isFinite(payload.bestSellerLimit)
      ? Math.max(1, Math.min(Math.floor(payload.bestSellerLimit ?? 1), 20))
      : 1;
    const category = typeof payload.bestSellerCategory === "string" && payload.bestSellerCategory.trim().length
      ? payload.bestSellerCategory.trim()
      : undefined;

    try {
      const results = await provider.search("best-sellers", {
        strategy: "best-sellers",
        limit,
        category,
      });
      results.forEach((entry) => setCachedListing(entry));
      normalizedListing = results[0] ?? null;
    } catch (error) {
      const response = mapProviderError(error);
      if (response) {
        console.error(
          JSON.stringify({
            event: "etsy.ingestion",
            provider: "unknown",
            url: category ?? "best-sellers",
            status: "error",
            duration_ms: Date.now() - startedAt,
            error: response.error,
            type: response.type,
            canRetry: response.canRetry,
            mode: "best-sellers",
          }),
        );
        return NextResponse.json(response, { status: response.status });
      }
      throw error;
    }

    if (normalizedListing) {
      listing = convertToListingInput(normalizedListing);
      if (!listingId && normalizedListing.id) {
        listingId = normalizedListing.id;
      }
      ingestionMode = "best-sellers";
      console.info(
        JSON.stringify({
          event: "etsy.ingestion",
          provider: normalizedListing.source,
          url: normalizedListing.url,
          status: "success",
          duration_ms: Date.now() - startedAt,
          fields_extracted: countExtractedFields(normalizedListing),
          cache: ingestionFromCache ? "hit" : "miss",
          mode: "best-sellers",
        }),
      );
    }
  }

  if (payload.listingUrl) {
    const startedAt = Date.now();
    const cached =
      getCachedListingByUrl(payload.listingUrl) ||
      getCachedListingById(extractListingIdFromUrl(payload.listingUrl));
    if (cached) {
      normalizedListing = cached;
      ingestionFromCache = true;
    } else {
      const provider = EtsyProviderFactory.get();
      try {
        normalizedListing = await provider.getListingByUrl(payload.listingUrl);
        setCachedListing(normalizedListing);
      } catch (error) {
        const response = mapProviderError(error);
        if (response) {
          console.error(
            JSON.stringify({
              event: "etsy.ingestion",
              provider: "unknown",
              url: payload.listingUrl,
              status: "error",
              duration_ms: Date.now() - startedAt,
              error: response.error,
              type: response.type,
              canRetry: response.canRetry,
            }),
          );
          return NextResponse.json(response, { status: response.status });
        }
        throw error;
      }
      }

    if (normalizedListing) {
      listing = convertToListingInput(normalizedListing);
      if (!listingId && normalizedListing.id) {
        listingId = normalizedListing.id;
      }
      ingestionMode = ingestionMode === "synced" ? ingestionMode : "url";
      console.info(
        JSON.stringify({
          event: "etsy.ingestion",
          provider: normalizedListing.source,
          url: normalizedListing.url,
          status: "success",
          duration_ms: Date.now() - startedAt,
          fields_extracted: countExtractedFields(normalizedListing),
          cache: ingestionFromCache ? "hit" : "miss",
        }),
      );
    }
  }

  if (!listing) {
    return NextResponse.json({ error: "Listing payload required" }, { status: 400 });
  }

  const report = analyzeListing(listing);

  let keywordResult: KeywordExtractionResult | null = null;
  let difficultyResult: DifficultyScoreResult | null = null;
  let suggestionResult: AiSuggestionResult | null = null;

  if (normalizedListing) {
    [keywordResult, difficultyResult, suggestionResult] = await Promise.all([
      keywordExtractionService.run(normalizedListing),
      difficultyScoringService.run(normalizedListing),
      aiSuggestionService.run(normalizedListing),
    ]);
  }

  if (supabase) {
    await supabase.from("listing_quality_audits").insert({
      listing_id: listingId ?? null,
      source_url: payload.listingUrl ?? normalizedListing?.url ?? (listingId ? null : "manual"),
      inputs: {
        title: listing.title,
        tags: listing.tags,
        materials: listing.materials,
        categories: listing.categories,
      },
      quality_score: report.qualityScore,
      completeness_score: report.completeness,
      sentiment_score: report.sentiment,
      readability_score: report.readability,
      keyword_density: report.keywordDensity,
      intent: report.intent,
      tone: report.tone,
      missing_attributes: report.missingAttributes,
      quick_fixes: report.quickFixes,
    });
  }

  await track("listing.intelligence.run", {
    listingId: listingId ?? "manual",
    missingAttributes: report.missingAttributes.length,
    qualityScore: report.qualityScore,
    ingestionSource: normalizedListing?.source ?? (listingId ? "synced" : "manual"),
    ingestionMode,
  });

  return NextResponse.json({
    listingId: listingId ?? null,
    listing: normalizedListing,
    report,
    pipelines: {
      keywords: keywordResult,
      difficulty: difficultyResult,
      suggestions: suggestionResult,
    },
    fromCache: ingestionFromCache,
  });
}

export const runtime = "nodejs";
