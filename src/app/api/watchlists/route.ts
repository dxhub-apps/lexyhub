import { NextResponse } from "next/server";

import { listWatchlists } from "@/lib/watchlists/service";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);

  try {
    const watchlists = await listWatchlists(userId);
    return NextResponse.json({ watchlists });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read watchlists.";
    const status = message.includes("Supabase") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
