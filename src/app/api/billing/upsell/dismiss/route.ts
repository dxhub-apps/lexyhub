import { NextRequest, NextResponse } from "next/server";

import { markUpsellDismissed } from "@/lib/billing/usage";

/**
 * POST /api/billing/upsell/dismiss
 * Mark an upsell trigger as dismissed
 *
 * Body:
 * {
 *   triggerId: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { triggerId } = body as { triggerId: string };

    if (!triggerId) {
      return NextResponse.json(
        { error: "triggerId is required" },
        { status: 400 }
      );
    }

    await markUpsellDismissed(triggerId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Upsell dismiss error:", error);
    return NextResponse.json(
      {
        error: "Failed to dismiss upsell",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
