import { NextResponse } from "next/server";

import { runScrapePipeline, scrapeEtsy, scrapeSocial, type ScrapeSource } from "@/lib/scraping/service";
import { assertAdmin } from "@/lib/backoffice/auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as {
      sources?: ScrapeSource[];
      source?: ScrapeSource;
      keyword?: string;
      limit?: number;
    };

    if (payload.sources && payload.sources.length > 0) {
      const results = await runScrapePipeline(payload.sources);
      return NextResponse.json({ results });
    }

    const source = payload.source ?? "etsy";
    if (source === "etsy") {
      const result = await scrapeEtsy({ keyword: payload.keyword, limit: payload.limit });
      return NextResponse.json({ results: [result] });
    }

    const result = await scrapeSocial({ keyword: payload.keyword, limit: payload.limit });
    return NextResponse.json({ results: [result] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute scraping job.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
