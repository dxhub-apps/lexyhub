import { NextResponse } from "next/server";

import { ensureWatchlist, addItemToWatchlist } from "@/lib/watchlists/service";

function resolveUserId(req: Request): string | null {
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) {
    return headerUserId;
  }

  const searchUserId = new URL(req.url).searchParams.get("userId");
  return searchUserId;
}

export async function POST(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "userId header or query parameter is required" }, { status: 400 });
  }

  const payload = (await req.json().catch(() => ({}))) as {
    watchlistName?: string;
    keywordId?: string;
    listingId?: string;
  };

  if (!payload.keywordId && !payload.listingId) {
    return NextResponse.json(
      { error: "keywordId or listingId is required" },
      { status: 400 },
    );
  }

  try {
    const watchlist = await ensureWatchlist(userId, {
      name: payload.watchlistName ?? "Operational Watchlist",
    });

    if (!watchlist) {
      return NextResponse.json(
        { error: "Watchlist service is not configured." },
        { status: 503 },
      );
    }

    const item = await addItemToWatchlist({
      userId,
      watchlistId: watchlist.id,
      keywordId: payload.keywordId,
      listingId: payload.listingId,
    });

    return NextResponse.json({
      watchlist,
      item,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update watchlist.";
    const normalized = message.toLowerCase();
    const status = normalized.includes("quota")
      ? 429
      : normalized.includes("supabase")
        ? 503
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
