import { NextResponse } from "next/server";

import { createProvenanceId } from "@/lib/keywords/utils";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DEFAULT_SAMPLE_LIMIT = 12;

type KeywordSerpSample = {
  id: string;
  keyword_id: string;
  listing_id: string | null;
  source: string;
  position: number | null;
  url: string | null;
  title: string | null;
  tags: string[];
  total_results: number | null;
  derived_metrics: Record<string, unknown> | null;
  captured_at: string | null;
  snapshot?: Record<string, unknown> | null;
  listings?: {
    id?: string;
    title?: string | null;
    url?: string | null;
  } | null;
};

function parseLimit(value: string | null): number {
  if (!value) {
    return DEFAULT_SAMPLE_LIMIT;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_SAMPLE_LIMIT;
  }
  return Math.min(50, Math.max(1, parsed));
}

function extractKeywordSnapshot(sample: KeywordSerpSample | null | undefined): {
  term: string | null;
  market: string | null;
} {
  const snapshot = (sample?.snapshot as Record<string, unknown> | undefined) ?? undefined;
  const directKeyword = snapshot?.keyword as Record<string, unknown> | undefined;
  const serpKeyword = (snapshot?.serp as Record<string, unknown> | undefined)?.keyword as
    | Record<string, unknown>
    | undefined;
  const keywordRecord = directKeyword ?? serpKeyword;
  const term = keywordRecord && typeof keywordRecord.term === "string" ? keywordRecord.term : null;
  const market = keywordRecord && typeof keywordRecord.market === "string" ? keywordRecord.market : null;
  return { term, market };
}

function toSamplePayload(sample: KeywordSerpSample) {
  const tags = Array.isArray(sample.tags) ? sample.tags : [];
  const derivedMetrics = (sample.derived_metrics as Record<string, unknown> | null | undefined) ?? null;
  const listing = sample.listings ?? null;
  const url = sample.url ?? (listing?.url ?? null) ?? null;
  return {
    id: sample.id,
    position: sample.position,
    source: sample.source,
    title: sample.title,
    url,
    tags,
    capturedAt: sample.captured_at,
    totalResults: sample.total_results ?? null,
    derivedMetrics,
    listing: listing
      ? {
          id: typeof listing.id === "string" ? listing.id : null,
          title: typeof listing.title === "string" ? listing.title : null,
          url: typeof listing.url === "string" ? listing.url : url,
        }
      : null,
  };
}

export async function GET(
  req: Request,
  context: { params: { keywordId: string } },
): Promise<NextResponse> {
  const keywordId = context.params?.keywordId;
  if (!keywordId || !keywordId.trim()) {
    return NextResponse.json({ error: "Keyword id is required." }, { status: 400 });
  }

  const limit = parseLimit(new URL(req.url).searchParams.get("limit"));
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("keyword_serp_samples")
    .select(
      "id, keyword_id, listing_id, source, position, url, title, tags, total_results, derived_metrics, captured_at, snapshot, listings:listing_id ( id, title, url )",
    )
    .eq("keyword_id", keywordId)
    .order("captured_at", { ascending: false })
    .limit(limit * 5);

  if (error) {
    console.error("Failed to load keyword SERP samples", error);
    return NextResponse.json({ error: "Unable to load SERP samples" }, { status: 500 });
  }

  const rows: KeywordSerpSample[] = (data ?? []) as KeywordSerpSample[];

  if (!rows.length) {
    return NextResponse.json({
      keywordId,
      provenanceId: createProvenanceId("unknown", "", ""),
      samples: [],
      listingExamples: [],
      totalResults: null,
      capturedAt: null,
    });
  }

  const summaryRow = rows.find((row) => row.position == null && row.listing_id == null) ?? null;
  const sampleRows = rows.filter((row) => row.position != null || row.listing_id != null);

  const timestamps = [summaryRow?.captured_at, ...sampleRows.map((row) => row.captured_at)].filter(
    (value): value is string => typeof value === "string" && Boolean(value),
  );
  const latestTimestamp = timestamps.reduce<string | null>((latest, current) => {
    if (!current) {
      return latest;
    }
    if (!latest) {
      return current;
    }
    return new Date(current).getTime() > new Date(latest).getTime() ? current : latest;
  }, null);

  const relevantSamples = latestTimestamp
    ? sampleRows.filter((row) => row.captured_at === latestTimestamp)
    : sampleRows;

  const limitedSamples = relevantSamples
    .sort((a, b) => {
      const aPosition = typeof a.position === "number" ? a.position : Number.POSITIVE_INFINITY;
      const bPosition = typeof b.position === "number" ? b.position : Number.POSITIVE_INFINITY;
      return aPosition - bPosition;
    })
    .slice(0, limit)
    .map(toSamplePayload);

  const keywordSnapshot = extractKeywordSnapshot(summaryRow ?? sampleRows[0]);
  const totalResults =
    summaryRow?.total_results ??
    (summaryRow?.snapshot as Record<string, unknown> | undefined)?.totalResults ??
    limitedSamples[0]?.totalResults ??
    null;

  const listingExamples = limitedSamples
    .map((sample) => sample.listing)
    .filter((listing): listing is NonNullable<typeof listing> => Boolean(listing?.id || listing?.url));

  return NextResponse.json({
    keywordId,
    keywordTerm: keywordSnapshot.term,
    keywordMarket: keywordSnapshot.market,
    provenanceId: createProvenanceId(
      limitedSamples[0]?.source ?? summaryRow?.source ?? "unknown",
      keywordSnapshot.market ?? "",
      keywordSnapshot.term ?? "",
    ),
    source: limitedSamples[0]?.source ?? summaryRow?.source ?? null,
    capturedAt: latestTimestamp,
    totalResults,
    samples: limitedSamples,
    listingExamples,
    summary: summaryRow
      ? {
          tags: Array.isArray(summaryRow.tags) ? summaryRow.tags : [],
          derivedMetrics: (summaryRow.derived_metrics as Record<string, unknown> | null | undefined) ?? null,
        }
      : null,
  });
}
