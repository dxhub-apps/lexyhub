import { NextRequest, NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

import { evaluateTagHealth, type TagCatalogEntry } from "@/lib/tags/optimizer";
import { getSupabaseServerClient } from "@/lib/supabase-server";

type TagHealthRequest = {
  listingId?: string;
  tags?: string[];
  catalog?: TagCatalogEntry[];
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const listingId = request.nextUrl.searchParams.get("listingId");
  if (!listingId) {
    return NextResponse.json({ error: "listingId query parameter is required" }, { status: 400 });
  }
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("listing_tag_health")
    .select("tag, score, status, diagnostics")
    .eq("listing_id", listingId)
    .order("tag", { ascending: true });
  if (error) {
    return NextResponse.json({ error: `Unable to load tag health: ${error.message}` }, { status: 500 });
  }
  return NextResponse.json({ listingId, diagnostics: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = (await request.json().catch(() => ({}))) as TagHealthRequest;
  const supabase = getSupabaseServerClient();

  let tags = payload.tags ?? [];
  if (!tags.length && payload.listingId && supabase) {
    const { data, error } = await supabase.from("listing_tags").select("tag").eq("listing_id", payload.listingId);
    if (error) {
      return NextResponse.json({ error: `Unable to load listing tags: ${error.message}` }, { status: 500 });
    }
    tags = (data ?? []).map((row) => row.tag ?? "").filter(Boolean);
  }

  if (!tags.length) {
    return NextResponse.json({ error: "At least one tag is required" }, { status: 400 });
  }

  let catalog = payload.catalog ?? [];
  if (!catalog.length && supabase) {
    const { data } = await supabase
      .from("tag_catalog")
      .select("tag, search_volume, trend_direction, competition_level, related_tags")
      .order("search_volume", { ascending: false })
      .limit(1000);
    catalog = (data ?? []).map((row) => ({
      tag: row.tag as string,
      searchVolume: Number(row.search_volume ?? 0),
      trend: (row.trend_direction ?? "stable") as TagCatalogEntry["trend"],
      competition: (row.competition_level ?? "medium") as TagCatalogEntry["competition"],
      related: Array.isArray(row.related_tags) ? (row.related_tags as string[]) : undefined,
    }));
  }

  if (!catalog.length) {
    return NextResponse.json({ error: "Tag catalog unavailable" }, { status: 503 });
  }

  const result = evaluateTagHealth({ tags, catalog });

  if (supabase && payload.listingId) {
    await supabase.from("listing_tag_health").upsert(
      result.diagnostics.map((diagnostic) => ({
        listing_id: payload.listingId,
        tag: diagnostic.tag,
        score: diagnostic.score,
        status: diagnostic.status,
        diagnostics: {
          message: diagnostic.message,
          suggestion: diagnostic.suggestion,
          searchVolume: diagnostic.searchVolume,
          trend: diagnostic.trend,
          competition: diagnostic.competition,
        },
      })),
      { onConflict: "listing_id,tag" },
    );

    await supabase.from("tag_optimizer_runs").insert({
      listing_id: payload.listingId,
      health_score: result.healthScore,
      duplicates: result.duplicates,
      low_volume_tags: result.lowVolumeTags,
      recommendations: result.recommendations,
    });
  }

  await track("tag.optimizer.run", {
    listingId: payload.listingId ?? "manual",
    tagCount: tags.length,
    duplicates: result.duplicates.length,
  });

  return NextResponse.json({ result });
}

export const runtime = "nodejs";
