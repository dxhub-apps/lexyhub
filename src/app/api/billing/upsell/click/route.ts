import { NextRequest, NextResponse } from "next/server";

import { markUpsellClicked } from "@/lib/billing/usage";

/**
 * POST /api/billing/upsell/click
 * Mark an upsell trigger as clicked
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

    await markUpsellClicked(triggerId);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Upsell click error:", error);
    return NextResponse.json(
      {
        error: "Failed to track upsell click",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
