import { NextResponse } from "next/server";

import { removeWatchlistItem } from "@/lib/watchlists/service";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);
  const itemId = params.id;

  if (!itemId) {
    return NextResponse.json({ error: "Watchlist item id is required" }, { status: 400 });
  }

  try {
    const removed = await removeWatchlistItem(userId, itemId);
    if (!removed) {
      return NextResponse.json({ error: "Watchlist item not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove watchlist item.";
    const normalized = message.toLowerCase();
    const status = normalized.includes("not allowed") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
