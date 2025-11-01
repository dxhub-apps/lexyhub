import { NextResponse } from "next/server";

import { summarizeBackoffice } from "@/lib/backoffice/status";
import { summarizeRiskRegister } from "@/lib/risk/service";
import { requireAdminUser } from "@/lib/backoffice/auth";

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdminUser();
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const [statusSummary, riskSummary] = await Promise.all([
      summarizeBackoffice(),
      summarizeRiskRegister(),
    ]);

    return NextResponse.json({
      metrics: statusSummary.metrics,
      crawlers: statusSummary.crawlers,
      riskSummary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load backoffice overview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
