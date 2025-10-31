import { NextResponse } from "next/server";

import { assertAdmin } from "@/lib/backoffice/auth";
import { syncRiskDataFromState } from "@/lib/risk/state-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    assertAdmin(request.headers);
  } catch (error) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const snapshot = await syncRiskDataFromState();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to synchronize risk data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
