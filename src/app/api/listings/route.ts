import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase-server";

type ListingResponse = {
  id: string;
  title: string;
  status: string;
  priceCents: number | null;
  currency: string | null;
  externalId: string;
  shopName: string | null;
  providerId: string;
  updatedAt: string | null;
  tags: string[];
  stats?: {
    views: number;
    favorites: number;
  };
};

function normalizeUserId(request: NextRequest): string | null {
  return request.nextUrl.searchParams.get("userId") ?? request.headers.get("x-lexy-user-id");
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  const userId = normalizeUserId(request);

  if (!supabase) {
    return NextResponse.json({ listings: [], warning: "Supabase client unavailable" }, { status: 200 });
  }

  if (!userId) {
    return NextResponse.json({ error: "User identifier required" }, { status: 401 });
  }

  let query = supabase
    .from("listings")
    .select(
      "id, title, status, price_cents, currency, external_listing_id, updated_at, marketplace_accounts!inner(id, provider_id, shop_name, user_id)"
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  query = query.eq("marketplace_accounts.user_id", userId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: `Failed to load listings: ${error.message}` }, { status: 500 });
  }

  const listingIds = (data ?? []).map((record) => record.id);

  const [tags, stats] = await Promise.all([
    supabase
      .from("listing_tags")
      .select("listing_id, tag")
      .in("listing_id", listingIds)
      .then((result) => result.data ?? []),
    supabase
      .from("listing_stats")
      .select("listing_id, views, favorites, recorded_on")
      .in("listing_id", listingIds)
      .order("recorded_on", { ascending: false })
      .then((result) => result.data ?? []),
  ]);

  const tagsByListing = new Map<string, string[]>();
  for (const tag of tags) {
    if (!tagsByListing.has(tag.listing_id)) {
      tagsByListing.set(tag.listing_id, []);
    }
    tagsByListing.get(tag.listing_id)?.push(tag.tag);
  }

  const statsByListing = new Map<string, { views: number; favorites: number; recordedOn: number }>();
  for (const stat of stats as Array<{ listing_id: string; views: number | null; favorites: number | null; recorded_on: string | null }>) {
    const recordedOn = stat.recorded_on ? new Date(stat.recorded_on).getTime() : Number.NEGATIVE_INFINITY;
    const existing = statsByListing.get(stat.listing_id);
    if (!existing || recordedOn > existing.recordedOn) {
      statsByListing.set(stat.listing_id, {
        views: Number(stat.views ?? 0),
        favorites: Number(stat.favorites ?? 0),
        recordedOn,
      });
    }
  }

  const listings: ListingResponse[] = (data ?? []).map((row) => {
    const account = Array.isArray(row.marketplace_accounts)
      ? row.marketplace_accounts[0]
      : row.marketplace_accounts;
    const stat = statsByListing.get(row.id);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priceCents: row.price_cents ?? null,
      currency: row.currency ?? null,
      externalId: row.external_listing_id,
      shopName: account?.shop_name ?? null,
      providerId: account?.provider_id ?? "etsy",
      updatedAt: row.updated_at ?? null,
      tags: tagsByListing.get(row.id) ?? [],
      stats: stat ? { views: stat.views, favorites: stat.favorites } : undefined,
    } satisfies ListingResponse;
  });

  return NextResponse.json({ listings });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
