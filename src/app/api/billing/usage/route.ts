import { NextRequest, NextResponse } from "next/server";

import { getCurrentUsage } from "@/lib/billing/enforce";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Get current monthly usage for a user.
 * Returns searches, ai_opportunities, and niches with used/limit.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const usage = await getCurrentUsage(userId);

    return NextResponse.json({ usage });
  } catch (error) {
    console.error("Failed to get current usage", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
