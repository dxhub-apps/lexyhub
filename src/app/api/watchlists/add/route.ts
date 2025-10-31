import { NextResponse } from "next/server";

import { ensureWatchlist, addItemToWatchlist } from "@/lib/watchlists/service";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { captureException, withSentryRouteHandler } from "@/lib/observability/sentry";
import { QuotaError } from "@/lib/usage/quotas";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export const POST = withSentryRouteHandler(async function POST(req: Request): Promise<NextResponse> {
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

    await captureServerEvent("watchlists.item_added", {
      distinctId: userId,
      properties: {
        watchlistId: watchlist.id,
        keywordId: payload.keywordId,
        listingId: payload.listingId,
      },
    });

    return NextResponse.json({
      watchlist,
      item,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update watchlist.";
    const normalized = message.toLowerCase();
    const isQuotaError = error instanceof QuotaError || normalized.includes("quota");
    const status = isQuotaError
      ? 429
      : normalized.includes("supabase")
        ? 503
        : 400;
    if (!isQuotaError) {
      captureException(error, {
        tags: { route: "watchlists", handler: "add" },
        user: { id: userId },
        extra: {
          status,
          keywordId: payload.keywordId,
          listingId: payload.listingId,
        },
      });
    }
    return NextResponse.json({ error: message }, { status });
  }
}, { name: "watchlists#POST", tags: { route: "/api/watchlists/add" } });
