import { NextResponse } from "next/server";

import { aggregateTrendSignals } from "@/lib/trends";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const { records, momentumByTerm } = await aggregateTrendSignals();
    const summary = Array.from(momentumByTerm.entries()).map(([term, metrics]) => ({
      term,
      momentum: metrics.momentum,
      expectedGrowth30d: metrics.expectedGrowth,
      sources: metrics.contributors,
    }));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: "stub",
      summary,
      records,
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("trend_series")
    .select("term, source, recorded_on, trend_score, velocity, expected_growth_30d, extras")
    .gte("recorded_on", since.toISOString().slice(0, 10))
    .order("recorded_on", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("Failed to load trend_series", error);
    const { records, momentumByTerm } = await aggregateTrendSignals();
    const summary = Array.from(momentumByTerm.entries()).map(([term, metrics]) => ({
      term,
      momentum: metrics.momentum,
      expectedGrowth30d: metrics.expectedGrowth,
      sources: metrics.contributors,
    }));
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: "fallback",
      summary,
      records,
    });
  }

  const grouped = new Map<
    string,
    {
      term: string;
      latest: string;
      momentum: number;
      expectedGrowth30d: number;
      sources: Set<string>;
      series: Array<{ recordedOn: string; trendScore: number; velocity: number; expectedGrowth30d: number; source: string }>;
    }
  >();

  for (const row of data ?? []) {
    const term = (row.term ?? "").toLowerCase();
    if (!grouped.has(term)) {
      grouped.set(term, {
        term,
        latest: row.recorded_on,
        momentum: Number(row.velocity ?? 0),
        expectedGrowth30d: Number(row.expected_growth_30d ?? 0),
        sources: new Set([row.source ?? "unknown"]),
        series: [],
      });
    }

    const entry = grouped.get(term)!;
    entry.sources.add(row.source ?? "unknown");
    entry.series.push({
      recordedOn: row.recorded_on,
      trendScore: Number(row.trend_score ?? 0),
      velocity: Number(row.velocity ?? 0),
      expectedGrowth30d: Number(row.expected_growth_30d ?? 0),
      source: row.source ?? "unknown",
    });
    entry.momentum = Number(((entry.momentum + Number(row.velocity ?? 0)) / 2).toFixed(4));
    entry.expectedGrowth30d = Number(
      ((entry.expectedGrowth30d + Number(row.expected_growth_30d ?? 0)) / 2).toFixed(4),
    );
  }

  const summary = Array.from(grouped.values()).map((entry) => ({
    term: entry.term,
    latest: entry.latest,
    momentum: entry.momentum,
    expectedGrowth30d: entry.expectedGrowth30d,
    sources: Array.from(entry.sources),
    series: entry.series.slice(0, 30),
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    source: "trend_series",
    summary,
  });
}

export const runtime = "nodejs";
