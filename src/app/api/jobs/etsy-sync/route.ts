import { NextRequest, NextResponse } from "next/server";

import { syncAllEtsyAccounts } from "@/lib/etsy/sync";
import { requireOfficialEtsyApiEnabled } from "@/lib/feature-flags";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();
  const userId = request.nextUrl.searchParams.get("userId") ?? undefined;
  const incremental = request.nextUrl.searchParams.get("mode") !== "full";

  const requireOfficialApi = await requireOfficialEtsyApiEnabled({ supabase });
  if (!requireOfficialApi) {
    return NextResponse.json(
      { message: "Etsy sync job skipped; require_official_etsy_api is disabled." },
      { status: 202 },
    );
  }

  const results = await syncAllEtsyAccounts(
    {
      userId,
      incremental,
    },
    supabase ?? undefined,
  );

  const summary = results.reduce(
    (acc, result) => {
      acc.processed += result.listingsProcessed;
      acc.upserted += result.listingsUpserted;
      if (result.status !== "success") {
        acc.failures.push({ accountId: result.accountId, error: result.error ?? "unknown" });
      }
      return acc;
    },
    { processed: 0, upserted: 0, failures: [] as Array<{ accountId: string; error: string }> },
  );

  return NextResponse.json({
    status: summary.failures.length > 0 ? "partial" : "success",
    results,
    summary,
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
