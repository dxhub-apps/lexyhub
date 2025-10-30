import { NextResponse } from "next/server";

import { ensureWatchlist, addItemToWatchlist } from "@/lib/watchlists/service";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export async function POST(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);
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
    const status = message.toLowerCase().includes("quota") ? 429 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
