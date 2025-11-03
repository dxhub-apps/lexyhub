import { NextResponse } from "next/server";

import { listWatchlists } from "@/lib/watchlists/service";

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  const searchUserId = new URL(req.url).searchParams.get("userId");
  return searchUserId;
}

export async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "userId header or query parameter is required" }, { status: 400 });
  }

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
