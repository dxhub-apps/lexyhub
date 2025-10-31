import { NextResponse } from "next/server";

import { listCrawlerStatuses } from "@/lib/backoffice/status";
import { assertAdmin } from "@/lib/backoffice/auth";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const crawlers = await listCrawlerStatuses();
    return NextResponse.json({ crawlers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load crawler statuses.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
