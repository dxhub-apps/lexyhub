import { NextResponse } from "next/server";

import { authenticatePartnerKey, checkPartnerRateLimit, recordPartnerRequest } from "@/lib/api/partner-auth";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function extractApiKey(headers: Headers): string | null {
  const headerKey = headers.get("x-api-key");
  if (headerKey) {
    return headerKey;
  }
  const auth = headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}

function parseLimit(searchParams: URLSearchParams): number {
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : 25;
  if (!Number.isFinite(limit) || limit <= 0) {
    return 25;
  }
  return Math.min(100, Math.max(1, Math.floor(limit)));
}

export async function GET(request: Request): Promise<NextResponse> {
  const apiKey = extractApiKey(request.headers);
  const context = await authenticatePartnerKey(apiKey);

  if (!context) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const allowed = await checkPartnerRateLimit(context);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase service unavailable" }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url.searchParams);
  const search = url.searchParams.get("q") ?? url.searchParams.get("term");
  const market = url.searchParams.get("market");
  const source = url.searchParams.get("source");

  let query = supabase
    .from("keywords")
    .select(
      "id, term, source, market, tier, trend_momentum, demand_index, competition_score, engagement_score, ai_opportunity_score, extras",
    )
    .order("trend_momentum", { ascending: false })
    .limit(limit);

  if (search) {
    query = query.ilike("term", `%${search}%`);
  }
  if (market) {
    query = query.eq("market", market);
  }
  if (source) {
    query = query.eq("source", source);
  }

  const started = Date.now();
  const { data, error } = await query;
  const latencyMs = Date.now() - started;

  if (error) {
    await recordPartnerRequest(context, "/api/v1/keywords", "GET", 500, latencyMs);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordPartnerRequest(context, "/api/v1/keywords", "GET", 200, latencyMs);

  const results = (data ?? []).map((row) => ({
    id: row.id,
    term: row.term,
    source: row.source,
    market: row.market,
    tier: row.tier,
    trendMomentum: Number(row.trend_momentum ?? 0),
    demandIndex: Number(row.demand_index ?? 0),
    competitionScore: Number(row.competition_score ?? 0),
    engagementScore: Number(row.engagement_score ?? 0),
    opportunityScore: Number(row.ai_opportunity_score ?? 0),
    extras: row.extras ?? {},
  }));

  return NextResponse.json({
    data: results,
    meta: {
      count: results.length,
      limit,
      partner: context.name,
      source: context.source,
    },
  });
}

export const runtime = "nodejs";
