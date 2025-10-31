import { NextRequest, NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

import { analyzeListing, type ListingInput } from "@/lib/listings/intelligence";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type ListingPayload = {
  listingId?: string;
  listing?: ListingInput;
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json().catch(() => ({}))) as ListingPayload;
  let listing: ListingInput | undefined = payload.listing;
  let listingId: string | undefined = payload.listingId ?? payload.listing?.id;

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

  if (!listing) {
    return NextResponse.json({ error: "Listing payload required" }, { status: 400 });
  }

  const report = analyzeListing(listing);

  if (supabase) {
    await supabase.from("listing_quality_audits").insert({
      listing_id: listingId ?? null,
      source_url: listingId ? null : "manual",
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
  });

  return NextResponse.json({ listingId: listingId ?? null, report });
}

export const runtime = "nodejs";
