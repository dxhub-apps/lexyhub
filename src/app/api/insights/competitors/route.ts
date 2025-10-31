import { NextRequest, NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

import { analyzeCompetitors, type CompetitorInsight, type CompetitorListing } from "@/lib/insights/competitors";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type RequestBody = {
  query: string;
  listings: CompetitorListing[];
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json().catch(() => ({}))) as Partial<RequestBody>;
  if (!payload.query || !payload.listings || !Array.isArray(payload.listings)) {
    return NextResponse.json({ error: "Query and listings are required" }, { status: 400 });
  }

  const insight: CompetitorInsight = analyzeCompetitors(payload.query, payload.listings);
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("competitor_snapshots")
      .insert({
        query: payload.query,
        strong_listing_count: insight.saturation.strong,
        weak_listing_count: insight.saturation.weak,
        total_listings: insight.saturation.total,
        summary: {
          price: insight.priceSummary,
          reviews: insight.reviewSummary,
          ratings: insight.ratingSummary,
          sharedPhrases: insight.sharedPhrases,
          adjectives: insight.commonAdjectives,
          narrative: insight.narrative,
        },
      })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      await supabase.from("competitor_snapshot_listings").insert(
        insight.rankedListings.slice(0, 50).map((listing) => ({
          snapshot_id: data.id,
          title: listing.title,
          price_cents: listing.priceCents ?? null,
          currency: listing.currency ?? null,
          reviews: listing.reviews ?? null,
          rating: listing.rating ?? null,
          sales_volume: listing.salesVolume ?? null,
          tag_count: listing.tags?.length ?? 0,
          tags: listing.tags ?? [],
          image_count: listing.imageCount ?? null,
          score: listing.score,
        })),
      );
    }
  }

  await track("competitor.analysis.run", {
    query: payload.query,
    listings: payload.listings.length,
    strong: insight.saturation.strong,
  });

  return NextResponse.json({ insight });
}

export const runtime = "nodejs";
