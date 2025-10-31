import { NextResponse } from "next/server";

import { listWatchlists } from "@/lib/watchlists/service";
import { captureException, withSentryRouteHandler } from "@/lib/observability/sentry";

function resolveUserId(headers: Headers): string {
  return headers.get("x-user-id") ?? "00000000-0000-0000-0000-000000000001";
}

export const GET = withSentryRouteHandler(async function GET(req: Request): Promise<NextResponse> {
  const userId = resolveUserId(req.headers);

  try {
    const watchlists = await listWatchlists(userId);
    return NextResponse.json({ watchlists });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read watchlists.";
    const status = message.includes("Supabase") ? 503 : 500;
    captureException(error, {
      tags: { route: "watchlists", handler: "list" },
      user: { id: userId },
      extra: { status },
    });
    return NextResponse.json({ error: message }, { status });
  }
}, { name: "watchlists#GET", tags: { route: "/api/watchlists" } });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
