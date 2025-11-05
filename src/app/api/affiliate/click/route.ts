import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { getAffiliateByCode, insertAffiliateClick } from "@/lib/db/affiliates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Records an affiliate click event.
 * Called by middleware when ?ref=CODE is detected.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { ref, path, utm } = await request.json();

    if (!ref || typeof ref !== "string") {
      return NextResponse.json({ error: "Invalid ref code" }, { status: 400 });
    }

    // Get IP and user agent
    const headersList = headers();
    const forwarded = headersList.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "0.0.0.0";
    const ua = headersList.get("user-agent") ?? "";

    // Check if affiliate exists and is active
    const affiliate = await getAffiliateByCode(ref);
    if (!affiliate) {
      // Silently ignore invalid codes (don't reveal which codes are valid)
      return NextResponse.json({ ok: true });
    }

    // Record click
    await insertAffiliateClick({
      affiliate_id: affiliate.id,
      ref_code: ref,
      landing_path: path ?? "/",
      utm: utm ?? {},
      ip,
      ua,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to record affiliate click", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
